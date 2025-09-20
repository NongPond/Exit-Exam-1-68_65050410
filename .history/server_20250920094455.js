const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const { sequelize, User, Category, Project, RewardTier, Pledge } = require('./models');
const authController = require('./controllers/authController');
const projectController = require('./controllers/projectController');
const pledgeController = require('./controllers/pledgeController');

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// session
app.use(session({
  secret: 'keyboard-cat-123',
  store: new SequelizeStore({ db: sequelize }),
  resave: false,
  saveUninitialized: false
}));

// attach user to res.locals for views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// routes
app.get('/', (req, res) => res.redirect('/projects'));
app.get('/login', authController.showLogin);
app.post('/login', authController.login);
app.get('/logout', authController.logout);

app.get('/projects', projectController.list);
app.get('/projects/:id', projectController.detail);

app.post('/pledge', pledgeController.create);

app.get('/stats', projectController.stats);

// initialize DB and seed sample data
(async () => {
  await sequelize.sync({ force: true });
  // seed
  // create Users (>=10)
  const users = [];
  for (let i=1;i<=12;i++){
    users.push(await User.create({ username: `user${i}`, password: `pw${i}` }));
  }
  // categories (>=3)
  const catTech = await Category.create({ name: 'Technology' });
  const catArt = await Category.create({ name: 'Art' });
  const catFood = await Category.create({ name: 'Food' });

  // create >= 8 projects across categories (each project id must be 8-digit, first digit !=0)
  const projectsData = [
    { code:'10000001', title:'Smart Umbrella', goal:50000, deadlineDays:40, categoryId:catTech.id },
    { code:'10000002', title:'Artisanal Pottery Book', goal:20000, deadlineDays:10, categoryId:catArt.id },
    { code:'20000003', title:'Open Source Robot', goal:100000, deadlineDays:90, categoryId:catTech.id },
    { code:'30000004', title:'Local Coffee Roaster', goal:30000, deadlineDays:25, categoryId:catFood.id },
    { code:'40000005', title:'Street Mural Project', goal:15000, deadlineDays:5, categoryId:catArt.id },
    { code:'50000006', title:'Healthy Snacks Startup', goal:45000, deadlineDays:60, categoryId:catFood.id },
    { code:'60000007', title:'Pocket Translator Device', goal:80000, deadlineDays:120, categoryId:catTech.id },
    { code:'70000008', title:'Photography Zine', goal:8000, deadlineDays:15, categoryId:catArt.id }
  ];

  const projects = [];
  for (const p of projectsData) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + p.deadlineDays);
    projects.push(await Project.create({
      code: p.code,
      title: p.title,
      goalAmount: p.goal,
      deadline,
      currentAmount: 0,
      categoryId: p.categoryId
    }));
  }

  // each project has 2-3 reward tiers
  for (const pj of projects) {
    await RewardTier.create({ name: 'Supporter', minAmount: 100, quota: 50, projectId: pj.id });
    await RewardTier.create({ name: 'Backer', minAmount: 500, quota: 20, projectId: pj.id });
    // some projects get a premium tier
    if (Math.random() > 0.5) {
      await RewardTier.create({ name: 'Premium', minAmount: 2000, quota: 5, projectId: pj.id });
    }
  }

  // create mixed pledges (some valid, some invalid) to count success/failed
  // We'll create some successful pledges and some rejected (e.g., too low for reward or past deadline)
  // successful
  await pledgeSample(users[0], projects[0], 500, 1); // pick reward 1 (Supporter)
  await pledgeSample(users[1], projects[1], 2500, 3); // maybe Premium if exists
  await pledgeSample(users[2], projects[2], 1000, 2);
  // invalid: less than reward min
  await Pledge.createRejected(users[3].id, projects[3].id, 50, null);
  // invalid: past deadline (create a project with past deadline then pledge)
  const pastProject = await Project.create({
    code:'80000009', title:'Expired Project', goalAmount:1000,
    deadline: new Date(Date.now() - 1000*60*60*24), currentAmount:0, categoryId: catArt.id
  });
  await RewardTier.create({ name:'Expired Tier', minAmount:100, quota:10, projectId: pastProject.id });
  await Pledge.createRejected(users[4].id, pastProject.id, 200, 1);

  console.log('Database seeded.');
  app.listen(3000, () => console.log('Server started on http://localhost:3000'));
})();

// helper to create a sample pledge via controller logic (use Pledge.createValid to ensure consistency)
async function pledgeSample(user, project, amount, rewardIndex) {
  // pick reward id
  const rewards = await RewardTier.findAll({ where: { projectId: project.id } });
  const reward = rewards[Math.min(rewardIndex-1, rewards.length-1)];
  if (!reward) {
    // simple pledge without reward
    await Pledge.createValid(user.id, project.id, amount, null);
  } else {
    await Pledge.createValid(user.id, project.id, amount, reward.id);
  }
}
