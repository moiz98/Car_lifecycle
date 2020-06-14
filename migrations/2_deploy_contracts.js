var Car_LifeCycle = artifacts.require("./Car_lifeCycle.sol");

module.exports = function(deployer) {
  deployer.deploy(Car_LifeCycle);
};