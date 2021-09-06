// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import {ERC1155} from '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';

contract MockERC1155 is ERC1155 {
    constructor(uint256 _amountForSale, uint256 _tokenId, address _saleAddress) ERC1155('some_URI') {
        _mint(_saleAddress, _tokenId, _amountForSale, "");
    }
}
