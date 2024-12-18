// pages/api/check-password.js

export default function handler(req, res) {
    const { password } = req.body;
    const correctPassword = process.env.PASSWORD;
  
    if (password === correctPassword) {
      res.status(200).json({ success: true });
    } else {
      res.status(401).json({ success: false });
    }
  }