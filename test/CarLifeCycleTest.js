var MotorbikeMart = artifacts.require("./MotorbikeMart.sol");

contract('MotorbikeMart', function (accounts) {
    const owner = accounts[0];
    const harley = accounts[1];
    const davidson = accounts[2];

    var vin;
    const inputVin = 777;
    const year = 2018;
    const make = "Kawasaki";
    const model = "Ninja";
    const capacity = 1200;

    const emptyAddress = '0x0000000000000000000000000000000000000000';

    it("register a new bike with provided VIN and details", async () => {
        const motorbikeMart = await MotorbikeMart.deployed();

        var eventEmitted = false;

        var event = motorbikeMart.NewBike();

        await event.watch((err, res) => {
            vin = res.args._vin;
            eventEmitted = true
        });

        await motorbikeMart.registerMotorbike(inputVin, year, model, make, capacity, {from: harley});

        const result = await motorbikeMart.fetchBike.call(vin);
        const numMotorbikes = await motorbikeMart.numMotorbikes.call();

        assert.equal(result[0], model, 'the model of the last added bike does not match the expected value');
        assert.equal(result[1], make, 'the make of the last added bike does not match the expected value');
        assert.equal(result[3], year, 'the year of the last added bike does not match the expected value');
        assert.equal(result[4].toString(10), 0, 'the status of the bike should be "RoadWorthy" which is declared first in the status enum');
        assert.equal(result[6], harley, 'the address adding the bike should be listed as the bikeOwner');
        assert.equal(result[7], emptyAddress, 'the buyer address should be set to 0 when a bike is added');

        assert.equal(eventEmitted, true, 'adding a car should emit a New Bike event');
        assert.equal(parseInt(numMotorbikes), 1, 'adding a car should add new car');
    });

    it("should allow bike owner to list bike up for sale with price", async () => {
        const motorbikeMart = await MotorbikeMart.deployed();

        var eventEmitted = false;

        var event = motorbikeMart.ForSale();

        await event.watch((err, res) => {
            vin = res.args._vin;
            eventEmitted = true
        });

        const salePrice = web3.toWei(2, "ether");

        await motorbikeMart.sellBike(vin, salePrice, {from: harley});

        const result = await motorbikeMart.fetchBike.call(vin);
        assert.equal(result[4].toString(10), 1, 'the status of the bike should be "For Sale" which is declared second in the status enum');
        assert.equal(result[5], salePrice, 'the price of the bike should be listed as salePrice');

        assert.equal(result[6], harley, 'the address adding the bike should be listed as the bikeOwner');
        assert.equal(result[7], emptyAddress, 'the buyer address should be set to 0 when a bike is added');
        assert.equal(eventEmitted, true, 'should emit a For Sale event');
    });

    var actualFee;
    it("should allow someone to purchase the bike", async () => {
        const motorbikeMart = await MotorbikeMart.deployed();

        var eventEmitted = false;

        var event = motorbikeMart.Sold();
        var fee = motorbikeMart.Fee();

        await event.watch((err, res) => {
            vin = res.args._vin;
            eventEmitted = true
        });

        await fee.watch((err, res) => {
            actualFee = res.args._fee;
        });

        const salePrice = web3.toWei(2, "ether");

        var aliceBalanceBefore = await web3.eth.getBalance(harley).toNumber();
        var bobbyBalanceBefore = await web3.eth.getBalance(davidson).toNumber();

        await motorbikeMart.buyBike(vin, {from: davidson, value: salePrice});

        var aliceBalanceAfter = await web3.eth.getBalance(harley).toNumber();
        var bobbyBalanceAfter = await web3.eth.getBalance(davidson).toNumber();

        const result = await motorbikeMart.fetchBike.call(vin);

        assert.equal(result[4].toString(10), 0, 'the status of the bike should be "Roadworthy" which is declared first in the status enum');
        assert.equal(result[6], davidson, 'the buyers address should be listed as the bikeOwner');
        assert.equal(result[7], davidson, 'the buyers address should be listed as the buyer');
        assert.equal(eventEmitted, true, 'should emit a Sold event');
        assert.equal(aliceBalanceAfter, aliceBalanceBefore + parseInt(salePrice, 10) - parseInt(actualFee, 10), "harley's balance should be increased by the salePrice of the bike");
        assert.isBelow(bobbyBalanceAfter, bobbyBalanceBefore - salePrice, "davidson's balance should be reduced by more than the price of the bike (including gas costs)");
        assert.equal(salePrice * (5 / 100), parseInt(actualFee, 10), "actual fee should be 1 percent of sale price");
    });

    it("should allow bike owner to transfer car to another owner", async () => {
        const motorbikeMart = await MotorbikeMart.deployed();

        var eventEmitted = false;

        var event = motorbikeMart.TransferVehicle();

        await event.watch((err, res) => {
            vin = res.args._vin;
            eventEmitted = true
        });

        await motorbikeMart.transferBike(vin, harley, {from: davidson});

        const result = await motorbikeMart.fetchBike.call(vin);

        assert.equal(result[0], model, 'the model of the last added bike does not match the expected value');
        assert.equal(result[1], make, 'the make of the last added bike does not match the expected value');
        assert.equal(result[3], year, 'the year of the last added bike does not match the expected value');
        assert.equal(result[4].toString(10), 0, 'the status of the bike should be "RoadWorthy" which is declared first in the status enum');
        assert.equal(result[6], harley, 'the address transfered to should be bikeOwner');

        assert.equal(eventEmitted, true, 'adding a car should emit a Transfer event');
    });

    it("should stop any transfer once circuit breaker is invoked", async () => {
        const motorbikeMart = await MotorbikeMart.deployed();

        var eventEmitted = false;

        var event = motorbikeMart.Stopped();

        await event.watch(() => {
            eventEmitted = true
        });

        await motorbikeMart.stop({from: owner});

        const stopped = await motorbikeMart.stopped.call();

        assert.equal(stopped, true, 'contract should be stopped for sensitive actions');

        try {
            await motorbikeMart.transferBike(vin, davidson, {from: harley});
        } catch (err) {
        }
    });

    it("should withdraw any balance from contract to owner", async () => {
        const motorbikeMart = await MotorbikeMart.deployed();

        var ownerBalanceBefore = await web3.eth.getBalance(owner).toNumber();

        await motorbikeMart.withdraw({from: owner});

        var ownerBalanceAfter = await web3.eth.getBalance(owner).toNumber();

        const stopped = await motorbikeMart.stopped.call();

        assert.equal(stopped, true, 'contract should be stopped for sensitive actions');
        assert.isBelow(ownerBalanceBefore, ownerBalanceAfter, 'owner balance should be higher after withdrawal');
    });
});