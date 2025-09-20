const { Pledge, RewardTier } = require('../models');

exports.create = async (req, res) => {
  // require login (simple)
  if (!req.session.user) return res.status(401).send('ต้อง login ก่อน');
  const userId = req.session.user.id;
  const { projectId, amount, rewardId } = req.body;
  try {
    // amount number
    const amt = parseInt(amount, 10);
    // if reward selected, ensure amount >= reward.minAmount etc. (handled in model helper)
    const pledge = await Pledge.createValid(userId, projectId, amt, rewardId || null);
    if (pledge.status === 'accepted') {
      res.redirect(`/projects/${projectId}`);
    } else {
      // increment a counter? we'll keep reason inside pledge record; view can display rejected count
      res.redirect(`/projects/${projectId}?pledge_failed=1`);
    }
  } catch (err) {
    console.error(err);
    res.redirect(`/projects/${projectId}?pledge_failed=1`);
  }
};
