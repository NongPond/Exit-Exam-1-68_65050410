const { User } = require('../models');

exports.showLogin = (req, res) => {
  res.render('login', { error: null });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username, password }});
  if (!user) {
    return res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  req.session.user = { id: user.id, username: user.username };
  res.redirect('/projects');
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
