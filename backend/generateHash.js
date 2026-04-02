const bcrypt = require("bcryptjs");

const yogiHash = bcrypt.hashSync("Yogi@123", 10);
const mansiHash = bcrypt.hashSync("Mansi@123", 10);

console.log("Yogi hash:", yogiHash);
console.log("Mansi hash:", mansiHash);
