import { ethers, waffle } from 'hardhat'
import { BigNumber, BigNumberish, constants, utils } from 'ethers'
// import BigNumber from 'bignumber.js';
// import  bignumber from 'big-number';
import { expect } from 'chai'
import chai  from 'chai'
import { BN } from 'ethereumjs-util';
import { AbiCoder } from 'ethers/lib/utils';

// import { latest } from '../node_modules/@openzeppelin/test-helpers/src/time';
// import { time } from '@openzeppelin/test-helpers/time';
chai.use(require('chai-bignumber')());

// const createFixtureLoader = waffle.createFixtureLoader

let mockToken: any;
let sale: any;
const ONE = BigNumber.from('1');
const TWO = BigNumber.from('2');

const NUL_ADDRESS = '0x0000000000000000000000000000000000000000';
const AMOUNT_TO_SALE = 1000;
const SALE_DURATION = 86400 * 14;
const TOKEN_ID = 1;
const ITEM_PRICE = ethers.utils.parseEther('1');



describe('test sale', () => {
    const [owner, alice, bob, other, creator1, creator2, creator3] = waffle.provider.getWallets()
    let royaltiesRecipients = [
        creator1.address,
        creator2.address,
        creator3.address
    ]
    let royaltiesBPs = [
        10,                 //  0.1%
        100,                //  1%
        1000                //  10%
    ]
    

    beforeEach('deploy contracts', async () => {
        const SaleFactory = await ethers.getContractFactory('TestSale');
        const MockFactory = await ethers.getContractFactory('MockERC1155');
        sale = await SaleFactory.deploy();
        mockToken = await MockFactory.deploy(AMOUNT_TO_SALE, TOKEN_ID, sale.address);
    })

    describe('before sale started', async() => {
        it('wont let buy before sale started', async () => {        
            await expect(sale.connect(alice).buy(1, { value: ethers.utils.parseEther('1')})).to.be.revertedWith('sale is not active');
        })
        it('should return owner', async() => {
            const contractOwner = await sale.owner();
            expect(contractOwner).to.be.equal(owner.address);
        })
        describe('sale initialization', async() => {
            it('wont let initialize if you are not the owner', async() => {
                await expect(sale.connect(alice).startSale(SALE_DURATION, ITEM_PRICE, mockToken.address, TOKEN_ID, royaltiesRecipients, royaltiesBPs)).to.be.revertedWith('access denied');
            }) 
            it('wont let initialize if sale duration is incorrect', async() => {
                await expect(sale.connect(owner).startSale(0, ITEM_PRICE, mockToken.address, TOKEN_ID, royaltiesRecipients, royaltiesBPs)).to.be.revertedWith('sale duration must be != 0');
            }) 
            it('wont let initialize if token address is 0', async() => {
                await expect(sale.connect(owner).startSale(SALE_DURATION, ITEM_PRICE, NUL_ADDRESS, TOKEN_ID, royaltiesRecipients, royaltiesBPs)).to.be.revertedWith('incorrect tokenToSale address');
            }) 
            it('wont let initialize if there is not enough token to sale on the contract (wrong id)', async() => {
                await expect(sale.connect(owner).startSale(SALE_DURATION, ITEM_PRICE, mockToken.address, 0, royaltiesRecipients, royaltiesBPs)).to.be.revertedWith('not enough tokens');
            }) 
            it('wont let initialize if price is incorrect', async() => {
                await expect(sale.connect(owner).startSale(SALE_DURATION, 0, mockToken.address, TOKEN_ID, royaltiesRecipients, royaltiesBPs)).to.be.revertedWith('invalid newItemPrice');
            }) 
            it('should emit event and start sale', async() => { 
                let now = Date.now() / 1000;               
                await expect(
                    sale.connect(owner).startSale(SALE_DURATION, ITEM_PRICE, mockToken.address, TOKEN_ID, royaltiesRecipients, royaltiesBPs)).to.emit(sale, 'SaleStarted');
                const saleDuration = await sale.saleDuration();
                const saleStart = await sale.saleStart();
                const tokenIdToSale = await sale.tokenIdToSale();
                const availableForSale = await sale.availableForSale();
                const itemPrice = await sale.itemPrice();
                expect( +saleDuration.toString() ).to.be.equal(SALE_DURATION);
                expect( +Math.round( +(saleStart.toString())/1000 ) ).to.be.equal( Math.round( now/1000 ));
                expect(+tokenIdToSale.toString() ).to.be.equal(TOKEN_ID);
                expect(+availableForSale.toString() ).to.be.equal(AMOUNT_TO_SALE);
                expect(+itemPrice.toString() ).to.be.equal(+ITEM_PRICE.toString());
            })
            it('wont let set fee recipient if his BPs is invalid', async() => {
                const recepientsWithInvalid = royaltiesRecipients.map((x) => x)
                recepientsWithInvalid.splice(1, 0, bob.address);  // insert some address at index = 1
                const bpsWithInvalid = royaltiesBPs.map((x) => x)
                bpsWithInvalid.splice(1, 0, 10001);  // insert invalid BPs at index = 1

                await sale.connect(owner).startSale(SALE_DURATION, ITEM_PRICE, mockToken.address, TOKEN_ID, recepientsWithInvalid, bpsWithInvalid);
                const recepients = await sale.getFeeRecipients(TOKEN_ID);
                const fees = await sale.getFeeBps(TOKEN_ID);
                for (let i = 0; i < royaltiesRecipients.length; i++ ){
                    expect(recepients[i]).to.be.equal(royaltiesRecipients[i]);
                }
                for (let i = 0; i < royaltiesBPs.length; i++ ){
                    expect(fees[i]).to.be.equal(royaltiesBPs[i]);
                }
            })
            it('should revert if sum fee >= 10000', async() => {
                const invalidBPs = [ 5000, 4999, 1];
                await expect(sale.connect(owner).startSale(SALE_DURATION, ITEM_PRICE, mockToken.address, TOKEN_ID, royaltiesRecipients, invalidBPs)).to.be.revertedWith('fees sum must be < 10000');
            })
            describe('when sale started', async() => {
                beforeEach('start sale', async() => {
                    await sale.connect(owner).startSale(SALE_DURATION, ITEM_PRICE, mockToken.address, TOKEN_ID, royaltiesRecipients, royaltiesBPs);
                })
                it('should return list of royalties recepients', async() => {
                    const recepients = await sale.getFeeRecipients(TOKEN_ID);
                    for (let i = 0; i < royaltiesRecipients.length; i++ ){
                        expect(recepients[i]).to.be.equal(royaltiesRecipients[i]);
                    }
                })
                it('should return list of royalties BPs', async() => {
                    const fees = await sale.getFeeBps(TOKEN_ID);
                    for (let i = 0; i < royaltiesBPs.length; i++ ){
                        expect(fees[i]).to.be.equal(royaltiesBPs[i]);
                    }
                })
                it('should return empty list of recipients if token id is incorrect', async() => {
                    const recepients = await sale.getFeeRecipients(2);
                    expect(recepients.length).to.be.equal(0);
                })
                it('should return empty list of bps if token id is incorrect', async() => {
                    const recepients = await sale.getFeeBps(2);
                    expect(recepients.length).to.be.equal(0);
                })
                it('wont let start sale again', async() => {
                    await expect(sale.connect(owner).startSale(SALE_DURATION, ITEM_PRICE, mockToken.address, TOKEN_ID, royaltiesRecipients, royaltiesBPs)).to.be.revertedWith('sale has already started');
                })
                it('wont let buy if user want too many tokens', async() => {
                    const fairPrice = ITEM_PRICE.mul(BigNumber.from(AMOUNT_TO_SALE.toString())).add(ONE);
                    await expect(sale.connect(alice).buy(AMOUNT_TO_SALE + 1, {value: fairPrice})).to.be.revertedWith('amount exceeds available');
                }) 
                it('wont let buy if user sent too little tokens', async() => {
                    const tooLittlePrice = ITEM_PRICE.sub(ONE);
                    await expect(sale.connect(alice).buy(1, {value: tooLittlePrice})).to.be.revertedWith('not enough funds');
                }) 
                describe('success buying', async() => { 
                    it('should let user buy one token and emit event', async() => {
                        const price = ITEM_PRICE;
                        const aliceBalanceBefore = await alice.getBalance();
                        // await expect(sale.connect(alice).buy(1, {value: price})).to.emit(sale, 'Sold');
                        const tx = await sale.connect(alice).buy(1, {value: price});
                        const receipt = await tx.wait();
                        const gasUsed = receipt.gasUsed;
                        const gasPrice = tx.gasPrice;
                        const gasCost = gasUsed.mul(gasPrice);
                        expect(receipt.events[1].event).to.be.equal('Sold');
                        expect(receipt.events[2].event).to.be.equal('SecondarySaleFees');
                        const aliceBalanceAfter = await alice.getBalance();
                        const aliceTokenBalance = await mockToken.balanceOf(alice.address, TOKEN_ID);
                        const saleTokenBalance = await mockToken.balanceOf(sale.address, TOKEN_ID);
                        // TODO MAKE ETH BALANCE CHECK FOR CONTRACT!!!!

                        const availableForSale = await sale.availableForSale();
                        expect(aliceBalanceBefore.sub(aliceBalanceAfter).toString()).to.be.equal(ITEM_PRICE.add(gasCost).toString());
                        expect(aliceTokenBalance.toString()).to.be.equal('1');
                        expect(saleTokenBalance).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).toString());
                        expect(availableForSale).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).toString());
                    })
                    it('should let several users buy some tokens and emit event', async() => {
                        const price = ITEM_PRICE;
                        const aliceBalanceBefore = await alice.getBalance();
                        const bobBalanceBefore = await bob.getBalance();
                        const otherBalanceBefore = await other.getBalance();

                        let tx = await sale.connect(alice).buy(1, {value: price});
                        let receipt1 = await tx.wait();
                        let gasUsed = receipt1.gasUsed;
                        let gasPrice = tx.gasPrice;
                        const gasCost1 = gasUsed.mul(gasPrice);

                        tx = await sale.connect(bob).buy(2, {value: price.mul(TWO)});
                        const receipt2 = await tx.wait();
                        gasUsed = receipt2.gasUsed;
                        gasPrice = tx.gasPrice;
                        const gasCost2 = gasUsed.mul(gasPrice);

                        tx = await sale.connect(other).buy(4, {value: price.mul(TWO).mul(TWO)});
                        const receipt3 = await tx.wait();
                        gasUsed = receipt3.gasUsed;
                        gasPrice = tx.gasPrice;
                        const gasCost3 = gasUsed.mul(gasPrice);

                        expect(receipt1.events[1].event).to.be.equal('Sold');
                        expect(receipt1.events[2].event).to.be.equal('SecondarySaleFees');
                        expect(receipt2.events[1].event).to.be.equal('Sold');
                        expect(receipt2.events[2].event).to.be.equal('SecondarySaleFees');
                        expect(receipt3.events[1].event).to.be.equal('Sold');
                        expect(receipt3.events[2].event).to.be.equal('SecondarySaleFees');

                        const aliceBalanceAfter = await alice.getBalance();
                        const bobBalanceAfter = await bob.getBalance();
                        const otherBalanceAfter = await other.getBalance();
                        const aliceTokenBalance = await mockToken.balanceOf(alice.address, TOKEN_ID);
                        const bobTokenBalance = await mockToken.balanceOf(bob.address, TOKEN_ID);
                        const otherTokenBalance = await mockToken.balanceOf(other.address, TOKEN_ID);
                        const saleTokenBalance = await mockToken.balanceOf(sale.address, TOKEN_ID);
                        // TODO MAKE ETH BALANCE CHECK FOR CONTRACT!!!!
                        const availableForSale = await sale.availableForSale();
                        expect(aliceBalanceBefore.sub(aliceBalanceAfter).toString()).to.be.equal(ITEM_PRICE.add(gasCost1).toString());
                        expect(bobBalanceBefore.sub(bobBalanceAfter).toString()).to.be.equal(ITEM_PRICE.mul(TWO).add(gasCost2).toString());
                        expect(otherBalanceBefore.sub(otherBalanceAfter).toString()).to.be.equal(ITEM_PRICE.mul(TWO).mul(TWO).add(gasCost3).toString());
                        expect(aliceTokenBalance.toString()).to.be.equal('1');
                        expect(bobTokenBalance.toString()).to.be.equal('2');
                        expect(otherTokenBalance.toString()).to.be.equal('4');
                        expect(saleTokenBalance).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).sub(TWO).sub(TWO.mul(TWO)).toString());
                        expect(availableForSale).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).sub(TWO).sub(TWO.mul(TWO)).toString());
                    })
                    it('should let user buy all tokens and shouldnt let buy more', async() => {
                        const price = ITEM_PRICE.mul(BigNumber.from(AMOUNT_TO_SALE));
                        const aliceBalanceBefore = await alice.getBalance();
                        await expect(sale.connect(alice).buy(AMOUNT_TO_SALE, {value: price})).to.emit(sale, 'Sold');
                        const aliceBalanceAfter = await alice.getBalance();
                        const aliceTokenBalance = await mockToken.balanceOf(alice.address, TOKEN_ID);
                        const saleTokenBalance = await mockToken.balanceOf(sale.address, TOKEN_ID);
                        // TODO MAKE ETH BALANCE CHECK FOR CONTRACT!!!!
                        const availableForSale = await sale.availableForSale();
                        expect(aliceBalanceBefore.sub(aliceBalanceAfter).div(ethers.utils.parseEther('0.001')).toString()).to.be.equal(price.div(ethers.utils.parseEther('0.001')).toString());
                        expect(aliceTokenBalance.toString()).to.be.equal(AMOUNT_TO_SALE.toString());
                        expect(saleTokenBalance).to.be.equal( '0' );
                        expect(availableForSale).to.be.equal( '0' );
                        await expect(sale.connect(alice).buy(1, {value: ITEM_PRICE})).to.be.revertedWith('sale is not active');
                    })
                    it('should let user buy tokens via direct payment', async() => {
                        const price = ITEM_PRICE;
                        const aliceBalanceBefore = await alice.getBalance();
                        let msg = {to: sale.address, value: price}
                        const transaction = await alice.sendTransaction(msg);
                        const receipt = await transaction.wait();
                        const gasUsed = receipt.gasUsed;
                        const gasPrice = transaction.gasPrice;
                        const gasCost = gasUsed.mul(gasPrice);

                        const aliceBalanceAfter = await alice.getBalance();
                        const aliceTokenBalance = await mockToken.balanceOf(alice.address, TOKEN_ID);
                        const saleTokenBalance = await mockToken.balanceOf(sale.address, TOKEN_ID);
                        // TODO MAKE ETH BALANCE CHECK FOR CONTRACT!!!!
                        const availableForSale = await sale.availableForSale();
                        expect(aliceBalanceBefore.sub(aliceBalanceAfter).toString()).to.be.equal(ITEM_PRICE.add(gasCost).toString());
                        expect(aliceTokenBalance.toString()).to.be.equal('1');
                        expect(saleTokenBalance).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).toString());
                        expect(availableForSale).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).toString());
                    })

                    it('shouldnt let user buy tokens via direct payment if eth send too small', async() => {
                        const price = ITEM_PRICE.sub(ONE);
                        const aliceBalanceBefore = await alice.getBalance();
                        let tx = {to: sale.address, value: price}
                        await expect(alice.sendTransaction(tx)).to.be.revertedWith('not enough eth');
                        
                    })

                    it('should return change', async() => {
                        const price = ITEM_PRICE.mul(TWO);              // More than needed
                        const aliceBalanceBefore = await alice.getBalance();
                        const tx = await sale.connect(alice).buy(1, {value: price});
                        const receipt = await tx.wait();
                        const gasUsed = receipt.gasUsed;
                        const gasPrice = tx.gasPrice;
                        const gasCost = gasUsed.mul(gasPrice);
                        const aliceBalanceAfter = await alice.getBalance();
                        const aliceTokenBalance = await mockToken.balanceOf(alice.address, TOKEN_ID);
                        const saleTokenBalance = await mockToken.balanceOf(sale.address, TOKEN_ID);
                        // TODO MAKE ETH BALANCE CHECK FOR CONTRACT!!!!
                        const availableForSale = await sale.availableForSale();
                        
                        expect(aliceBalanceBefore.sub(aliceBalanceAfter).toString()).to.be.equal(ITEM_PRICE.add(gasCost).toString());
                        expect(aliceTokenBalance.toString()).to.be.equal('1');
                        expect(saleTokenBalance).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).toString());
                        expect(availableForSale).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).toString());
                    })

                    it('wont let user buy tokens when sales is stopped', async() => {
                        await ethers.provider.send("evm_increaseTime", [SALE_DURATION + 1])
                        await ethers.provider.send("evm_mine",[]); //
                        const price = ITEM_PRICE.mul(TWO);              // More than needed
                        await expect(sale.connect(alice).buy(1, {value: price})).to.be.revertedWith('sale is not active');
                    })

                    describe('privileged actions', async() => {
                        it('should let owner change price', async() => {
                            const newPrice = ITEM_PRICE.mul(TWO);
                            await expect(sale.setItemPrice(newPrice)).to.emit(sale, 'NewPrice');
                            const salesNewPrice = await sale.itemPrice();
                            expect(salesNewPrice.toString()).to.be.equal(newPrice.toString());
                        })
                        it('shouldnt let owner change price if it equals to old one', async() => {
                            const newPrice = ITEM_PRICE;
                            await expect(sale.setItemPrice(newPrice)).to.be.revertedWith('this itemPrice already set');
                        })
                        it('shouldnt let owner change price if it is = 0', async() => {
                            await expect(sale.setItemPrice(0)).to.be.revertedWith('invalid newItemPrice');
                        })
                        it('should let owner withdraw all eth', async() => {
                            const price = ITEM_PRICE;
                            await expect(sale.connect(alice).buy(1, {value: price})).to.emit(sale, 'Sold');
                            await expect(sale.connect(bob).buy(2, {value: price.mul(TWO)})).to.emit(sale, 'Sold');
                            await expect(sale.connect(other).buy(4, {value: price.mul(TWO).mul(TWO)})).to.emit(sale, 'Sold');
                            const totalCharge = price.add(price.mul(TWO)).add(price.mul(TWO).mul(TWO));
                            const ownerBalanceBefore = await owner.getBalance();
                            const tx = await sale.connect(owner).withdrawAll();
                            const receipt = await tx.wait();
                            const gasUsed = receipt.gasUsed;
                            const gasPrice = tx.gasPrice;
                            const gasFee = gasPrice.mul(gasUsed);
                            const ownerBalanceAfter = await owner.getBalance();
                            const sumBPs = royaltiesBPs.reduce((a, b) => a + b, 0)
                            const sumFee = totalCharge.mul(BigNumber.from(sumBPs)).div(BigNumber.from('10000'));
                            expect( ownerBalanceAfter.sub(ownerBalanceBefore).toString()).to.be.equal(totalCharge.sub(sumFee).sub(gasFee).toString());
                        })

                        it('should let owner withdraw part of eth', async() => {
                            const price = ITEM_PRICE;
                            await expect(sale.connect(alice).buy(1, {value: price})).to.emit(sale, 'Sold');
                            await expect(sale.connect(bob).buy(2, {value: price.mul(TWO)})).to.emit(sale, 'Sold');
                            const ownerBalanceBefore = await owner.getBalance();
                            const tx = await sale.connect(owner).withdraw(price);
                            const receipt = await tx.wait();
                            const gasUsed = receipt.gasUsed;
                            const gasPrice = tx.gasPrice;
                            const gasFee = gasPrice.mul(gasUsed);
                            const ownerBalanceAfter = await owner.getBalance();
                            expect( ownerBalanceAfter.sub(ownerBalanceBefore).toString()).to.be.equal(price.sub(gasFee).toString());
                        })
                        it('shouldnt let owner withdraw zero amount of eth', async() => {
                            const price = ITEM_PRICE;
                            await expect(sale.connect(alice).buy(1, {value: price})).to.emit(sale, 'Sold');
                            await expect(sale.connect(bob).buy(2, {value: price.mul(TWO)})).to.emit(sale, 'Sold');
                            await expect(sale.connect(owner).withdraw(0)).to.be.revertedWith('amount must be != 0');
                            
                        })
                        it('shouldnt let user withdraw ', async() => {
                            const price = ITEM_PRICE;
                            await expect(sale.connect(alice).buy(1, {value: price})).to.emit(sale, 'Sold');
                            await expect(sale.connect(bob).buy(2, {value: price.mul(TWO)})).to.emit(sale, 'Sold');
                            await expect(sale.connect(alice).withdraw(price)).to.be.revertedWith('access denied');
                            
                        })
                        it('shouldnt let owner withdraw more than contract has', async() => {
                            const price = ITEM_PRICE;
                            await expect(sale.connect(alice).buy(1, {value: price})).to.emit(sale, 'Sold');
                            await expect(sale.connect(bob).buy(2, {value: price.mul(TWO)})).to.emit(sale, 'Sold');
                            await expect(sale.connect(owner).withdraw(price.mul(TWO).mul(TWO))).to.be.revertedWith('not enough balance');
                            
                        })
                    })
                    describe('royalties sending', async() => {
                        it('should correctly send royalties', async() => {
                            const price = ITEM_PRICE;
                            
                            const creator1BalanceBefore = await creator1.getBalance();
                            const creator2BalanceBefore = await creator2.getBalance();
                            const creator3BalanceBefore = await creator3.getBalance();
                            let balancesBefore = [creator1BalanceBefore, creator2BalanceBefore, creator3BalanceBefore];
                            await expect(sale.connect(alice).buy(1, {value: price})).to.emit(sale, 'Sold');
                            await expect(sale.connect(bob).buy(2, {value: price.mul(TWO)})).to.emit(sale, 'Sold');
                            const totalCharge = price.add(price.mul(TWO));
                            const creator1BalanceAfter = await creator1.getBalance();
                            const creator2BalanceAfter = await creator2.getBalance();
                            const creator3BalanceAfter = await creator3.getBalance();
                            let balancesAfter = [creator1BalanceAfter, creator2BalanceAfter, creator3BalanceAfter];
                            for (let i = 0; i < royaltiesRecipients.length; i++){
                                expect(balancesAfter[i].sub(balancesBefore[i])).to.be.equal(totalCharge.mul(royaltiesBPs[i]).div(BigNumber.from(10000)));
                            }

                        })
                    })

                    describe('magic function', async() => {
                        it('buy with magic function', async() => {
                            const aliceBalanceBefore = await alice.getBalance();
                            let ABI = [
                                "function buy(uint amount)"
                            ];
                            let iface = new ethers.utils.Interface(ABI);
                            const encodedData = iface.encodeFunctionData("buy", [ 1 ]);
                            const tx = await sale.connect(alice).magicFunction(encodedData, {value: ITEM_PRICE});
                            console.log(alice.address);
                            const receipt = await tx.wait();
                            const gasUsed = receipt.gasUsed;
                            const gasPrice = tx.gasPrice;
                            const gasCost = gasUsed.mul(gasPrice);
                            expect(receipt.events[1].event).to.be.equal('Sold');
                            expect(receipt.events[2].event).to.be.equal('SecondarySaleFees');
                            const aliceBalanceAfter = await alice.getBalance();
                            const aliceTokenBalance = await mockToken.balanceOf(alice.address, TOKEN_ID);
                            const saleTokenBalance = await mockToken.balanceOf(sale.address, TOKEN_ID);
                            const availableForSale = await sale.availableForSale();
                            expect(aliceBalanceBefore.sub(aliceBalanceAfter).toString()).to.be.equal(ITEM_PRICE.add(gasCost).toString());
                            expect(aliceTokenBalance.toString()).to.be.equal('1');
                            expect(saleTokenBalance).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).toString());
                            expect(availableForSale).to.be.equal( BigNumber.from(AMOUNT_TO_SALE).sub(ONE).toString());
                        })
                        it('wont let user withdraw via magicFunction if not the owner', async() => {
                            const price = ITEM_PRICE;
                            await expect(sale.connect(alice).buy(1, {value: price})).to.emit(sale, 'Sold');
                            await expect(sale.connect(bob).buy(2, {value: price.mul(TWO)})).to.emit(sale, 'Sold');
                            let ABI = [
                                "function withdraw(uint amount)"
                            ];
                            let iface = new ethers.utils.Interface(ABI);
                            const encodedData = iface.encodeFunctionData("withdraw", [ 1 ]);
                            await expect(sale.connect(alice).magicFunction(encodedData, {value: price})).to.be.revertedWith('no magic');
                            
                        })
                    })

                })
            })

            
        })
    })
    

    

        
        
    


})
