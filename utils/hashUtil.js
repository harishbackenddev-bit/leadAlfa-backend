const bcrypt=require('bcrypt');

const hashPassword=async(plainPassword)=>{
   const salt=await bcrypt.genSalt(10);
   return await bcrypt.hash(plainPassword,salt);
};

const comparePasswords=async(plainPwd,hashedPwd) => {
     return await bcrypt.compare(plainPwd, hashedPwd);
};

module.exports = { hashPassword, comparePasswords };
