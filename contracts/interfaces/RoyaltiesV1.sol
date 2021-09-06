// SPDX-License-Identifier: MIT

pragma solidity =0.8.7;

interface RoyaltiesV1 {
    event SecondarySaleFees(uint256 tokenId, address payable[] recipients, uint[] bps);

    function getFeeRecipients(uint256 id) external view returns (address payable[] memory);
    function getFeeBps(uint256 id) external view returns (uint256[] memory);
}