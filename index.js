import { ethers, BigNumber } from "ethers";
import axios from "axios";
import { readFileSync } from "fs";

const CUSTODIAN = readFileSync("./custodian/artifacts/contracts/Custodian.sol/Custodian.json", "utf8");

const uniswap_graph =
  "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";

export const main = async (poolAddress, owner, lossThreshold) => {
  owner = owner.toLowerCase();
  poolAddress = poolAddress.toLowerCase();
  let data;
  try {
    data = await axios.post(uniswap_graph, {
      query: `
                {
                    positions(where: {pool_contains: "${poolAddress}", liquidity_gt: "0" owner: "${owner}"}){
                        owner
                        liquidity
                        depositedToken0
                        depositedToken1
                        pool{
                            token0{
                                id
      	                        symbol
                                decimals
     	                    }
                            token1{
                                id
                                symbol
                                decimals
                            }
                            tick
                            token0Price
                            token1Price
                        }
                        tickLower{
                            price0
                            price1
                        }
                        tickUpper{
                            price0
                            price1
                        }
                    }
                }
            `,
    });
  } catch (err) {
    console.log(err);
    return err;
  }

  console.log("Result: ", data.data.data);

  data.data.data.positions.forEach(function (item, index){
    viewPosition(item, lossThreshold, owner, poolAddress);
  })
};

function viewPosition(position, lossThreshold, owner, poolAddress){
    priceLower = position.tickLower.price0
    priceUpper = position.tickUpper.price0
    liquidity = position.liquidity

    price = 1300; // need to know how to fetch
    currentPrice = position.pool.token0Price

    // amount of token0
    x = position.depositedToken0
    current_x = 0;

    // amount of token1
    y = position.depositedToken1
    current_y = 0;

    if(currentPrice < priceLower){
        current_x = liquidity/sqrt(priceLower) - liquidity/sqrt(priceUpper);
    }

    else if(currentPrice > priceUpper){
        current_y = liquidity * (priceUpper - priceLower);
    }

    else{
        current_x = liquidity/sqrt(currentPrice) - liquidity/sqrt(priceUpper);

        current_y = liquidity * (currentPrice - priceLower);
    }

    calculateImpermanentLoss(x, y, current_x, current_y, lossThreshold, owner, poolAddress);
}

function calculateImpermanentLoss(x, y, current_x, current_y, lossThreshold, owner, pool){
    price0, price1, currentPrice0, currentPrice1, custodianAddress;

    loss =
      ((currentPrice0 * current_x +
        currentPrice1 * current_y -
        price0 * x -
        price1 * y) *
        100) /
      (price0 * x + price1 * y);

    if(loss > lossThreshold){
        
        const provider =  new ethers.providers.JsonRpcProvider(process.env.RpcUrl)
        const wallet = new ethers.Wallet(process.env.PrivateKey, provider)

        const custodian = new ethers.Contract(custodianAddress, CUSTODIAN, wallet);

        custodian.decreaseLiquidity(0);
    }
}

// main("0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640","0xf9404708c16ec50dd563ca0bef2f07eb32d3d7c2");

