import jwt from "jsonwebtoken"

const generateToken = (userId, time) => {   
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn:time
  })
}

const verifyToken = (token) => { 
  return jwt.verify(token, process.env.JWT_SECRET);
}

export { 
  generateToken,
  verifyToken
}