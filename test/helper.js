const { ethers } = require('hardhat');

async function increase(amount) {
    await ethers.provider.send("evm_increaseTime", [amount]);
    await ethers.provider.send("evm_mine");
}

function tokens(amount) {
    return ethers.utils.parseEther(amount.toString());
}

module.exports = { 
    increase,
    tokens
};