import { ethers } from 'hardhat'
const TOKEN_ID = 1;
const AMOUNT_TO_SALE = 1000;

async function main() {
  // We get the contract to deploy
  const TestSale = await ethers.getContractFactory("TestSale");
  const MockFactory = await ethers.getContractFactory('MockERC1155');

  console.log("Deploying Sale contract...");
  const testSale = await TestSale.deploy();
  console.log("Sale contract deployed to:", testSale.address);

  console.log("Deploying Mock ERC1155...");
  const mockToken = await MockFactory.deploy(AMOUNT_TO_SALE, TOKEN_ID, testSale.address);
  console.log("Mock contract deployed to:", testSale.address);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
