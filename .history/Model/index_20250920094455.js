const { Sequelize, DataTypes, Op } = require('sequelize');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: './database.sqlite', logging: false });

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true },
  password: DataTypes.STRING
});

const Category = sequelize.define('Category', {
  name: DataTypes.STRING
});

const Project = sequelize.define('Project', {
  code: { type: DataTypes.STRING(8), allowNull: false, unique: true }, // 8-digit string
  title: DataTypes.STRING,
  goalAmount: { type: DataTypes.INTEGER, validate: { min: 1 } },
  deadline: DataTypes.DATE,
  currentAmount: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const RewardTier = sequelize.define('RewardTier', {
  name: DataTypes.STRING,
  minAmount: { type: DataTypes.INTEGER, validate: { min: 0 } },
  quota: { type: DataTypes.INTEGER, defaultValue: 0 }
});

const Pledge = sequelize.define('Pledge', {
  amount: { type: DataTypes.INTEGER, allowNull: false },
  time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.ENUM('accepted','rejected'), defaultValue: 'accepted' },
  reason: DataTypes.STRING
});

// relations
Category.hasMany(Project);
Project.belongsTo(Category);

Project.hasMany(RewardTier);
RewardTier.belongsTo(Project);

User.hasMany(Pledge);
Pledge.belongsTo(User);

Project.hasMany(Pledge);
Pledge.belongsTo(Project);

RewardTier.hasMany(Pledge);
Pledge.belongsTo(RewardTier);

// Business logic helpers (static methods)
Pledge.createValid = async function(userId, projectId, amount, rewardId) {
  // validate business rules
  const project = await Project.findByPk(projectId);
  if (!project) throw new Error('Project not found');
  if (new Date(project.deadline) < new Date()) {
    // reject
    return Pledge.create({ UserId: userId, ProjectId: projectId, amount, RewardTierId: rewardId, status:'rejected', reason:'deadline passed' });
  }
  if (rewardId) {
    const reward = await RewardTier.findByPk(rewardId);
    if (!reward) return Pledge.create({ UserId: userId, ProjectId: projectId, amount, RewardTierId: rewardId, status:'rejected', reason:'reward not found' });
    if (amount < reward.minAmount) return Pledge.create({ UserId: userId, ProjectId: projectId, amount, RewardTierId: rewardId, status:'rejected', reason:'amount below reward minimum' });
    if (reward.quota <= 0) return Pledge.create({ UserId: userId, ProjectId: projectId, amount, RewardTierId: rewardId, status:'rejected', reason:'reward quota exhausted' });
    // accept: update project currentAmount and decrement quota
    await project.increment('currentAmount', { by: amount });
    await reward.decrement('quota', { by: 1 });
    return Pledge.create({ UserId: userId, ProjectId: projectId, amount, RewardTierId: rewardId, status:'accepted' });
  } else {
    // no reward chosen, accept if deadline ok and amount >0
    if (amount <= 0) return Pledge.create({ UserId: userId, ProjectId: projectId, amount, RewardTierId: null, status:'rejected', reason:'invalid amount' });
    await project.increment('currentAmount', { by: amount });
    return Pledge.create({ UserId: userId, ProjectId: projectId, amount, RewardTierId: null, status:'accepted' });
  }
};

Pledge.createRejected = async function(userId, projectId, amount, rewardId) {
  return Pledge.create({ UserId:userId, ProjectId:projectId, amount, RewardTierId: rewardId, status:'rejected', reason: 'seeded rejection' });
};

module.exports = { sequelize, Sequelize, Op, User, Category, Project, RewardTier, Pledge };
