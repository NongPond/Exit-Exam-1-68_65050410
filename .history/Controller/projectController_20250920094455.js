const { Project, Category, RewardTier, Pledge, Sequelize, Op } = require('../models');

exports.list = async (req, res) => {
  const q = req.query.q || '';
  const category = req.query.category || '';
  const sort = req.query.sort || ''; // newest / ending / funded

  const where = {};
  if (q) where.title = { [Op.like]: `%${q}%` };
  if (category) where['CategoryId'] = category;

  let order = [['createdAt','DESC']];
  if (sort === 'ending') order = [['deadline','ASC']];
  if (sort === 'funded') order = [['currentAmount','DESC']];

  const categories = await Category.findAll();
  const projects = await Project.findAll({
    where, include: [Category],
    order
  });

  res.render('projects', { projects, categories, q, category, sort });
};

exports.detail = async (req, res) => {
  const id = req.params.id;
  const project = await Project.findByPk(id, { include: [Category, RewardTier] });
  if (!project) return res.status(404).send('Project not found');

  // progress percent
  const percent = Math.min(100, Math.round((project.currentAmount / project.goalAmount) * 100));

  // fetch pledge stats for this project
  const accepted = await Pledge.count({ where: { ProjectId: project.id, status: 'accepted' }});
  const rejected = await Pledge.count({ where: { ProjectId: project.id, status: 'rejected' }});

  res.render('project_detail', { project, percent, accepted, rejected });
};

exports.stats = async (req, res) => {
  // overall accepted / rejected
  const accepted = await Pledge.count({ where: { status: 'accepted' }});
  const rejected = await Pledge.count({ where: { status: 'rejected' }});
  res.render('stats', { accepted, rejected });
};
