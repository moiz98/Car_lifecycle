
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
    mapping(uint => Vehicle) public VehicleMap;
    uint public numVehicles;
    uint constant SALE_FEE_PERCENT = 5;

    constructor() public {
        numVehicles = 0;
    }

    event NewVehicle(uint _vin, address _owner);
    event TransferVehicle(uint _vin);
    event ForSale(uint _vin);
    event Sold(uint _vin);
    event Fee(uint _fee);

    enum Status {RoadWorthy, ForSale, Financed}

    struct Vehicle {
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
        uint _price = VehicleMap[_vin].price;
        uint amountToRefund = msg.value - _price;
        VehicleMap[_vin].buyer.transfer(amountToRefund);
    }

    // Check car is set as for Sale by owner
    modifier forSale(uint _vin) {
        require (VehicleMap[_vin].status == Status.ForSale); _;
    }

    modifier roadWorthy(uint _vin) {
        require (VehicleMap[_vin].status == Status.RoadWorthy); _;
    }

    modifier VehicleOwnerOnly(address _owner) {
        require (msg.sender == _owner);
        _;
    }

    function registerVehicle(uint _vin, uint _year, string _model, string _make, uint _capacity) public {
        emit NewVehicle(_vin, msg.sender);
        vins.push(_vin);
        VehicleMap[_vin] = Vehicle({
        vin: _vin, year: _year, model: _model, make: _make, owner: msg.sender, buyer: 0, status: Status.RoadWorthy, price: 0, capacity: _capacity
        });
        numVehicles++;
    }

    function sellVehicle(uint _vin, uint _price) VehicleOwnerOnly(VehicleMap[_vin].owner) roadWorthy(_vin) public {
        emit ForSale(_vin);
        VehicleMap[_vin].status = Status.ForSale;
        VehicleMap[_vin].price = _price;
        VehicleMap[_vin].buyer = 0;
    }

    function buyVehicle(uint vin) public stopInEmergency forSale(vin) paidEnough(VehicleMap[vin].price) checkValue(vin) payable {
        emit Sold(vin);
        VehicleMap[vin].status = Status.RoadWorthy;
        VehicleMap[vin].buyer = msg.sender;
        address owner = VehicleMap[vin].owner;

        // Transfer ownership across
        VehicleMap[vin].owner = msg.sender;

        // send ether to "owner"
        // Take a 5% fee out of the price
        uint fee = (VehicleMap[vin].price).mul(SALE_FEE_PERCENT) / 100;

        emit Fee(fee);

        owner.transfer((VehicleMap[vin].price).sub(fee));
    }

    function transferVehicle(uint _vin, address _newOwner) VehicleOwnerOnly(VehicleMap[_vin].owner) roadWorthy(_vin) stopInEmergency public returns (string) {
        emit TransferVehicle(_vin);
        VehicleMap[_vin].owner = _newOwner;
        VehicleMap[_vin].status = Status.RoadWorthy;
    }

    /* Fetch Vehicle info by VIN */
    function fetchVehicle(uint _vin) public view returns (string model, string make, uint vin, uint year, uint status, uint price, address owner, address buyer, uint capacity) {
        model = VehicleMap[_vin].model;
        make = VehicleMap[_vin].make;
        vin = VehicleMap[_vin].vin;
        year = VehicleMap[_vin].year;
        price = VehicleMap[_vin].price;
        status = uint(VehicleMap[_vin].status);
        owner = VehicleMap[_vin].owner;
        buyer = VehicleMap[_vin].buyer;
        capacity = VehicleMap[_vin].capacity;
        return (model, make, vin, year, status, price, owner, buyer, capacity);
    }

    function getVehicleOwner(uint _vin) public constant returns (address) {
        address owner = VehicleMap[_vin].owner;
        return owner;
    }

    function getMake(uint _vin) public constant returns (string) {
        string storage vmake = VehicleMap[_vin].make;
        return vmake;
    }

    function getModel(uint _vin) public constant returns (string) {
        string storage vmodel = VehicleMap[_vin].model;
        return vmodel;
    }

    function getYear(uint _vin) public constant returns (uint) {
        uint vyear = VehicleMap[_vin].year;
        return vyear;
    }

    function getVins() public view returns (uint[]) {
        return vins;
    }

    
    // Fallback function Added so ether sent to this contract is reverted if the contract fails
    function() public {
        revert();
    }
}