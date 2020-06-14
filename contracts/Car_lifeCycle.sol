
pragma solidity ^0.4.23;
//
// ----------------------------------------------------------------------------
// Owned contract
// ----------------------------------------------------------------------------
contract Owned {
    address public owner;
    address public newOwner;

    event OwnershipTransferred(address indexed _from, address indexed _to);

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner {
        require (msg.sender == owner, "Only owner can call this function");
        _;
    }

    function transferOwnership(address _newOwner) public onlyOwner {
        require(newOwner != address(0));
        newOwner = _newOwner;
    }

    function acceptOwnership() public {
        require(msg.sender == newOwner);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        newOwner = address(0);
    }
}

//
// ----------------------------------------------------------------------------
// Circuit breaker contract
// ----------------------------------------------------------------------------

contract CircuitBreaker is Owned {

    bool public stopped = false;

    event Stopped();

    modifier stopInEmergency {require(!stopped);
        _;}

    modifier onlyInEmergency {require(stopped);
        _;}

    function withdraw() onlyInEmergency public {
        owner.transfer(address(this).balance);
    }

    function stop() onlyOwner public returns (bool) {
        stopped = true;
    }

    function start() onlyOwner public returns (bool) {
        stopped = false;
    }
}

// ----------------------------------------------------------------------------
// Safe maths
// ----------------------------------------------------------------------------
library SafeMath {
    function add(uint a, uint b) internal pure returns (uint c) {
        c = a + b;
        require(c >= a);
    }
    function sub(uint a, uint b) internal pure returns (uint c) {
        require(b <= a);
        c = a - b;
    }
    function mul(uint a, uint b) internal pure returns (uint c) {
        c = a * b;
        require(a == 0 || c / a == b);
    }
    function div(uint a, uint b) internal pure returns (uint c) {
        require(b > 0);
        c = a / b;
    }
}

//
// ----------------------------------------------------------------------------
// Car LifeCycle contract
// ----------------------------------------------------------------------------

contract Car_lifeCycle is Owned, CircuitBreaker {
    using SafeMath for uint;
    uint[] public vins;
    mapping(uint => Bike) public motorbikeMap;
    uint public numMotorbikes;
    uint constant SALE_FEE_PERCENT = 5;

    constructor() public {
        numMotorbikes = 0;
    }

    event NewBike(uint _vin, address _owner);
    event TransferVehicle(uint _vin);
    event ForSale(uint _vin);
    event Sold(uint _vin);
    event Fee(uint _fee);

    enum Status {RoadWorthy, ForSale, Financed}

    struct Bike {
        uint vin;
        uint year;
        string model;
        string make;
        uint capacity;
        address owner;
        address buyer;
        Status status;
        uint price;
    }

    modifier paidEnough(uint _price) { require(msg.value >= _price); _;}

    modifier checkValue(uint _vin) {
        //refund them after pay for item (why it is before, _ checks for logic before func)
        _;
        uint _price = motorbikeMap[_vin].price;
        uint amountToRefund = msg.value - _price;
        motorbikeMap[_vin].buyer.transfer(amountToRefund);
    }

    // Check car is set as for Sale by owner
    modifier forSale(uint _vin) {
        require (motorbikeMap[_vin].status == Status.ForSale); _;
    }

    modifier roadWorthy(uint _vin) {
        require (motorbikeMap[_vin].status == Status.RoadWorthy); _;
    }

    modifier bikeOwnerOnly(address _owner) {
        require (msg.sender == _owner);
        _;
    }

    function registerMotorbike(uint _vin, uint _year, string _model, string _make, uint _capacity) public {
        emit NewBike(_vin, msg.sender);
        vins.push(_vin);
        motorbikeMap[_vin] = Bike({
        vin: _vin, year: _year, model: _model, make: _make, owner: msg.sender, buyer: 0, status: Status.RoadWorthy, price: 0, capacity: _capacity
        });
        numMotorbikes++;
    }

    function sellBike(uint _vin, uint _price) bikeOwnerOnly(motorbikeMap[_vin].owner) roadWorthy(_vin) public {
        emit ForSale(_vin);
        motorbikeMap[_vin].status = Status.ForSale;
        motorbikeMap[_vin].price = _price;
        motorbikeMap[_vin].buyer = 0;
    }

    function buyBike(uint vin) public stopInEmergency forSale(vin) paidEnough(motorbikeMap[vin].price) checkValue(vin) payable {
        emit Sold(vin);
        motorbikeMap[vin].status = Status.RoadWorthy;
        motorbikeMap[vin].buyer = msg.sender;
        address owner = motorbikeMap[vin].owner;

        // Transfer ownership across
        motorbikeMap[vin].owner = msg.sender;

        // send ether to "owner"
        // Take a 5% fee out of the price
        uint fee = (motorbikeMap[vin].price).mul(SALE_FEE_PERCENT) / 100;

        emit Fee(fee);

        owner.transfer((motorbikeMap[vin].price).sub(fee));
    }

    function transferBike(uint _vin, address _newOwner) bikeOwnerOnly(motorbikeMap[_vin].owner) roadWorthy(_vin) stopInEmergency public returns (string) {
        emit TransferVehicle(_vin);
        motorbikeMap[_vin].owner = _newOwner;
        motorbikeMap[_vin].status = Status.RoadWorthy;
    }

    /* Fetch bike info by VIN */
    function fetchBike(uint _vin) public view returns (string model, string make, uint vin, uint year, uint status, uint price, address owner, address buyer, uint capacity) {
        model = motorbikeMap[_vin].model;
        make = motorbikeMap[_vin].make;
        vin = motorbikeMap[_vin].vin;
        year = motorbikeMap[_vin].year;
        price = motorbikeMap[_vin].price;
        status = uint(motorbikeMap[_vin].status);
        owner = motorbikeMap[_vin].owner;
        buyer = motorbikeMap[_vin].buyer;
        capacity = motorbikeMap[_vin].capacity;
        return (model, make, vin, year, status, price, owner, buyer, capacity);
    }

    function getBikeOwner(uint _vin) public constant returns (address) {
        address owner = motorbikeMap[_vin].owner;
        return owner;
    }

    function getMake(uint _vin) public constant returns (string) {
        string storage vmake = motorbikeMap[_vin].make;
        return vmake;
    }

    function getModel(uint _vin) public constant returns (string) {
        string storage vmodel = motorbikeMap[_vin].model;
        return vmodel;
    }

    function getYear(uint _vin) public constant returns (uint) {
        uint vyear = motorbikeMap[_vin].year;
        return vyear;
    }

    function getVins() public view returns (uint[]) {
        return vins;
    }

    // Fallback function - Called if other functions don't match call or
    // sent ether without data
    // Typically, called when invalid data is sent
    // Added so ether sent to this contract is reverted if the contract fails
    function() public {
        revert();
    }
}