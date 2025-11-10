const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../../models');

const ACCESS_EXPIRES = '1h';

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, country } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Email déjà utilisé' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      email, passwordHash, firstName, lastName, phone, country, role: 'client'
    });

    return res.status(201).json({
      message: 'Utilisateur créé',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Identifiants invalides' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Identifiants invalides' });

    await user.update({ lastLogin: new Date() });

    const token = signAccess({ id: user.id, role: user.role });

    return res.json({
      message: 'Connexion réussie',
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'lastLogin', 'createdAt']
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.json({ user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erreur' });
  }
};
