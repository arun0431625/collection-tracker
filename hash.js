const bcrypt = require("bcryptjs");

bcrypt.hash("Branch@123", 10).then(hash => {
  console.log(hash);
});
