// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./interfaces/RoyaltiesV1.sol";
import "./interfaces/IERC1155Receiver.sol";

contract TestSale is RoyaltiesV1, IERC1155Receiver {
    address public immutable owner; // Owner's address
    uint256 public itemPrice; // Fixed price for one token
    uint256 public saleStart; // block.timestamp of initialization transaction
    uint256 public saleDuration; // Duration of sale in seconds
    uint256 public availableForSale; // Remaining amount of tokens
    uint256 public tokenIdToSale; // ERC1155 tokenID using for sale
    IERC1155 public tokenToSale;

    uint256 public constant maxBPs = 10000; // Maximum BPs (100%)

    address payable[] public royaltiesRecipients; // List of fee recepients
    uint256[] public royaltiesBPs; // List of fees' amounts

    event Sold(address indexed buyer, uint256 amount, uint256 itemPrice);
    event SaleStarted(
        address initiator,
        uint256 saleStart,
        uint256 saleDuration,
        uint256 availableForSale,
        uint256 tokenIdToSale
    );
    event NewPrice(uint256 oldPrice, uint256 newPrice);

    constructor() {
        owner = msg.sender;
    }

    function getFeeRecipients(uint256 id)
        external
        view
        override
        returns (address payable[] memory)
    {
        if (id == tokenIdToSale) return royaltiesRecipients;
        address payable[] memory empty;
        return empty;
    }

    function getFeeBps(uint256 id)
        external
        view
        override
        returns (uint256[] memory)
    {
        if (id == tokenIdToSale) return royaltiesBPs;
        uint256[] memory empty;
        return empty;
    }

    function setItemPrice(uint256 _newItemPrice) public onlyOwner {
        require(_newItemPrice > 0, "invalid newItemPrice");
        uint256 oldPrice = itemPrice;
        require(_newItemPrice != oldPrice, "this itemPrice already set");
        itemPrice = _newItemPrice;
        emit NewPrice(oldPrice, _newItemPrice);
    }

    function isActive() public view returns (bool) {
        if (
            itemPrice > 0 &&
            saleStart <= block.timestamp &&
            block.timestamp <= saleStart + saleDuration &&
            availableForSale > 0
        ) return true;
        return false;
    }

    function startSale(
        uint256 _saleDuration,
        uint256 _itemPrice,
        address _tokenToSale,
        uint256 _tokenIdToSale,
        address payable[] memory _royaltiesRecipients,
        uint256[] memory _royaltiesBPs
    ) external onlyOwner {
        require(!isActive(), "sale has already started");
        require(_saleDuration > 0, "sale duration must be != 0");
        require(_tokenToSale != address(0), "incorrect tokenToSale address");
        uint256 tokenBalance = IERC1155(_tokenToSale).balanceOf(
            address(this),
            _tokenIdToSale
        );
        require(tokenBalance > 0, "not enough tokens");
        setItemPrice(_itemPrice);
        saleDuration = _saleDuration;
        saleStart = block.timestamp;
        tokenIdToSale = _tokenIdToSale;
        availableForSale = tokenBalance;
        tokenToSale = IERC1155(_tokenToSale);
        uint256 feeSum;
        for (uint256 i = 0; i < _royaltiesRecipients.length; i++) {
            // ignore if some element is >= maxBPs
            if (_royaltiesBPs[i] < maxBPs) {
                royaltiesBPs.push(_royaltiesBPs[i]);
                royaltiesRecipients.push(_royaltiesRecipients[i]);
                feeSum += _royaltiesBPs[i];
            }
        }
        require(feeSum < maxBPs, "fees sum must be < 10000");
        emit SaleStarted(
            msg.sender,
            saleStart,
            _saleDuration,
            tokenBalance,
            _tokenIdToSale
        );
    }

    function buy(uint256 _amount) public payable {
        require(isActive(), "sale is not active");
        require(_amount <= availableForSale, "amount exceeds available");
        uint256 totalCharge = _amount * itemPrice;
        require(msg.value >= totalCharge, "not enough funds");
        availableForSale -= _amount;
        address payable[] memory recipients = royaltiesRecipients;
        uint256[] memory fees = royaltiesBPs;
        for (uint256 i = 0; i < recipients.length; i++) {
            recipients[i].transfer((totalCharge * fees[i]) / maxBPs);
        }
        tokenToSale.safeTransferFrom(
            address(this),
            msg.sender,
            tokenIdToSale,
            _amount,
            ""
        );
        if (msg.value > totalCharge)
            payable(msg.sender).transfer(msg.value - totalCharge);
        emit Sold(msg.sender, _amount, itemPrice);
        emit SecondarySaleFees(tokenIdToSale, recipients, fees);
    }

    function withdraw(uint256 _amount) external onlyOwner {
        require(_amount > 0, "amount must be != 0");
        require(_amount <= address(this).balance, "not enough balance");
        payable(owner).transfer(_amount);
    }

    function withdrawAll() external onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner).transfer(balance);
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override view returns (bytes4) {
        return IERC1155Receiver(address(this)).onERC1155Received.selector;
    }

    function magicFunction(bytes memory _encodedData) external payable {
        (bool success, ) = address(this).delegatecall(_encodedData);
        require(success, "no magic");
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "access denied");
        _;
    }

    receive() external payable {
        uint256 amount = msg.value / itemPrice;
        require(amount >= 1, "not enough eth");
        buy(amount);
    }
}
