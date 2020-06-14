//from github/trufflesuite/truffle-contract library

App = {
    web3Provider: null,
    contracts: {},

    init: function () {
        return App.initWeb3();
    },

    initWeb3: function () {
        // Initialize web3 and set the provider to the testRPC.
        if (typeof web3 !== 'undefined') {
            App.web3Provider = web3.currentProvider;
            web3 = new Web3(web3.currentProvider);
        } else {
            // set the provider you want from Web3.providers
            App.web3Provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
            web3 = new Web3(App.web3Provider);
        }
        console.log('init');
        return App.initContract();
    },

    initContract: function () {
        $.getJSON('Car_lifeCycle.json', function (data) {
            // Get the necessary contract artifact file and instantiate it with truffle-contract.
            var MotorbikeMartArtifact = data;
            App.contracts.MotorbikeMart = TruffleContract(MotorbikeMartArtifact);

            // Set the provider for our contract.
            App.contracts.MotorbikeMart.setProvider(App.web3Provider);

            // Use our contract to retrieve and mark the listed motorbikes which are owned by user.
            return App.getMotorBikes();
        });

        //jquery triggers
        return App.bindEvents();
    },

    getMotorBikes: async function () {
        var bikeRows = $('#listedBikes');
        var bikeTemplate = $('#bikeTemplate');

        var motorMartInstance;

        web3.eth.getAccounts(function(error, accounts) {
            if (error) {
                console.log(error);
            }

            var account = accounts[0];

            App.contracts.MotorbikeMart.deployed().then(function (instance) {
                motorMartInstance = instance;
                return motorMartInstance.getVins.call()
            }).then(function (vins) {
                for (var i=0; i < vins.length; i++) {
                    motorMartInstance.fetchBike.call(vins[i]).then(function (details) {
                        var sellPrice = web3.fromWei(details[5], 'ether');
                        bikeTemplate.find('#descTitle').text(details[0] + ' ' + details[1]);
                        bikeTemplate.find('.vin').text(details[2].toNumber());
                        bikeTemplate.find('.year').text(details[3].toNumber());
                        bikeTemplate.find('.capacity').text(details[8].toNumber());
                        bikeTemplate.find('.price').text(sellPrice);
                        bikeTemplate.find('.sellPrice').text(sellPrice);

                        // Set id of the sellPrice input field to link to VIN
                        bikeTemplate.find('.sellPrice').attr('id', ('sellPrice' + details[2].toString()));

                        bikeTemplate.find('.btn-sellVehicle').attr('data-id', details[2].toNumber());
                        bikeTemplate.find('.btn-buyVehicle').attr('data-id', details[2].toNumber());
                        bikeTemplate.find('.btn-buyVehicle').attr('data-price', sellPrice);

                        // Disable Buy button if status is not for sale
                        var status;
                        switch(details[4].toNumber()) {
                            case 0:
                                status = 'Road Worthy';
                                bikeTemplate.find('.btn-buyVehicle').attr('disabled', true);
                                break;
                            case 1:
                                status = 'For Sale';
                                bikeTemplate.find('.btn-buyVehicle').attr('disabled', false);
                                break;
                            case 2:
                                status = 'Financed';
                                break;
                        }

                        bikeTemplate.find('.status').text(status);

                        // Disable Buy button for owner == account
                        if (details[6] == account) {
                            bikeTemplate.find('.btn-buyVehicle').attr('disabled', true);
                            bikeTemplate.find('.btn-sellVehicle').attr('disabled', false);
                            bikeTemplate.find('.owner-badge').show();
                        } else {
                            bikeTemplate.find('.btn-sellVehicle').attr('disabled', true);
                            bikeTemplate.find('.owner-badge').hide();
                        }

                        bikeRows.append(bikeTemplate.html());

                    });
                }
            })
        });

    },

    bindEvents: function () {
        $(document).on('click', '#submitButton', App.submitDetail);
        $(document).on('click', '#searchButton', App.search);
        $(document).on('click', '#transferButton', App.transfer);
        $(document).on('click', '.btn-sellVehicle', App.sellVehicle);
        $(document).on('click', '.btn-buyVehicle', App.buyVehicle);
    },

    sellVehicle: function(event) {
        event.preventDefault();

        var vin = parseInt($(event.target).data('id'));
        var inputId = '#sellPrice' + vin;
        var sellPrice = parseInt($(inputId).val());
        console.log("sell price", vin, sellPrice);

        if (!sellPrice) {
            $(inputId).attr('style', "border-radius: 5px; border:#FF0000 1px solid;");
            $(inputId).focus();
            return;
        }

        var price = web3.toWei(sellPrice, "ether");

        var motorMartInstance;

        web3.eth.getAccounts(function (error, accounts) {

            if (error) {
                console.log(error);
            }

            var account = accounts[0];
            App.contracts.MotorbikeMart.deployed().then(function (instance) {
                motorMartInstance = instance;

                var contractEvent = motorMartInstance.ForSale();

                contractEvent.watch(function (err, res) {
                    var vin = res.args._vin;
                    console.log("succesfully listed for sale", vin);
                    location.reload();
                });

                motorMartInstance.sellBike(vin, price, {from: account});
            }).catch(function (err) {
                console.log(err.message);
            });
        });
    },
    buyVehicle: function(event) {
        event.preventDefault();

        var vin = parseInt($(event.target).data('id'));
        var price = parseInt($(event.target).data('price'));
        console.log("buy price", vin, price);

        if (!price) {
            return;
        }

        var price = web3.toWei(price, "ether");

        var motorMartInstance;

        web3.eth.getAccounts(function (error, accounts) {

            if (error) {
                console.log(error);
            }

            var account = accounts[0];
            App.contracts.MotorbikeMart.deployed().then(function (instance) {
                motorMartInstance = instance;

                var contractEvent = motorMartInstance.Sold();

                contractEvent.watch(function (err, res) {
                    var vin = res.args._vin;
                    console.log("succesfully sold", vin);
                    setTimeout(location.reload(), 2000);
                });

                motorMartInstance.buyBike(vin, {from: account, value: price});
            }).catch(function (err) {
                console.log(err.message);
            });
        });
    },
    submitDetail: function (event) {
        event.preventDefault();

        var vin = parseInt($('#vin').val());
        var year = $('#year').val();
        var model = $('#model').val();
        var make = $('#make').val();
        var capacity = $('#capacity').val();

        console.log(vin);

        var motorMartInstance;

        web3.eth.getAccounts(function (error, accounts) {

            if (error) {
                console.log(error);
            }
            console.log('accounts: ',accounts);
            var account = accounts[0];
            App.contracts.MotorbikeMart.deployed().then(function (instance) {
                motorMartInstance = instance;
                console.log("check:" + account);

                var contractEvent = motorMartInstance.NewBike();

                contractEvent.watch(function (err, res) {
                    var vin = res.args._vin;
                    console.log("succesfully listed for sale", vin);
                });

                return motorMartInstance.registerMotorbike(vin, year, model, make, capacity, {from: account});
            }).then(function (result) {
                setTimeout(location.reload(), 2000);
            }).catch(function (err) {
                console.log(err.message);
            });
        });
    },

    search: function (event) {
        event.preventDefault();

        var vsid = parseInt($('#vsvin').val());


        console.log(vsid);

        var motorMartInstance;

        web3.eth.getAccounts(function (error, accounts) {

            if (error) {
                console.log(error);
            }

            var account = accounts[0];
            App.contracts.MotorbikeMart.deployed().then(function (instance) {
                motorMartInstance = instance;
                console.log("check" + account);

                return motorMartInstance.fetchBike.call(vsid);
            }).then(function (result) {
                var askPrice = web3.fromWei(result[5], 'ether');
                $('#owneraddress').text(result[6]);
                $('#vmake').text(result[1]);
                $('#vmodel').text(result[0]);
                $('#vvin').text(result[2]);
                $('#vyear').text(result[3]);

                $('#vcapacity').text(result[8]);

                // Bike is for sale
                switch (result[4].toNumber()) {
                    case 0:
                        $('#vstatus').text('Road worthy');
                        $('#vprice').text('No price set');
                        break;
                    case 1:
                        $('#vstatus').text('For Sale');
                        $('#vprice').text(askPrice);
                        break;
                    case 2:
                        $('#vstatus').text('Financed');
                        $('#vprice').text('Financed');
                }

                console.log(result)
            }).catch(function (err) {
                console.log(err.message);
            });
        });
    },
    transfer: function (event) {
        event.preventDefault();

        var vtid = parseInt($('#vtid').val());
        var newOwnerAddress = $('#newOwnerAddress').val();

        console.log(vtid);

        var motorMartInstance;

        web3.eth.getAccounts(function (error, accounts) {

            if (error) {
                console.log(error);
            }

            var account = accounts[0];
            App.contracts.MotorbikeMart.deployed().then(function (instance) {
                motorMartInstance = instance;
                var contractEvent = motorMartInstance.TransferVehicle();

                contractEvent.watch(function (err, res) {
                    var vin = res.args._vin;
                    console.log("succesfully transferred", vin);
                    setTimeout(location.reload(), 2000);
                });

                motorMartInstance.transferBike(vtid, newOwnerAddress, {from: account});
            })
            .catch(function (err) {
                console.log(err.message);
            });
        });
    }
};

$(function () {
    $(window).load(function () {
        App.init();
    });
});
