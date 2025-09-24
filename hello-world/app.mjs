import util from "util";
import crypto from "crypto";
import AWS from "aws-sdk";

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */

export const lambdaHandler = async (event, context) => {
  const { httpMethod, path } = event;

  console.log(`httpMethod: ${httpMethod}, path: ${path}`);

  /*
  * View the Menu
  */
  if (httpMethod === "GET" && path === "/menu") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        menu: {
          sizes: ["small", "medium", "large", "xlarge"],
          crusts: ["regular", "thick", "thin", "stuffed"],
          sauces: ["regular", "light", "extra", "alfredo"],
          cheeses: ["regular", "extra", "none", "cheddar"],
          toppings: {
            meats: ["pepperoni", "italian sausage", "canadian bacon", "ham", "hamburger", "bacon", "chicken", "salami", "anchovies"],
            vegetables: ["spinach", "peppers", "mushrooms", "olives", "tomatos", "onions", "jalapenos", "pineapple"]
          },
        }
      })
    };
  }

  /*
  * Customize a Pizza
  */
  if (httpMethod === "POST" && path === "/customize") {
    // Parse the JSON
    const pizza = JSON.parse(event.body || {});
    console.log("Parsed body:", util.inspect(pizza, { depth: null }));

    // Make sure pizza is valid
    validatePizza(pizza);

    // Calculate Price
    let calculatedPrice = calculatePrice(pizza);

    // Caclulate Calories
    let calculatedCalories = calculateCalories(pizza);

    return {
      statusCode: 200,
      body: JSON.stringify({
        size: pizza.size,
        crust: pizza.crust,
        sauce: pizza.sauce,
        cheese: pizza.cheese,
        toppings: pizza.toppings,
        price: calculatedPrice,
        calories: calculatedCalories
      })
    };
  }

  /*
  * Place an Order
  */
  if (httpMethod === "POST" && path === "/order") {
    // parse the pizza and payment details
    const pizza = JSON.parse(event.body);
    const payment = pizza.payment;

    // validate pizza
    validatePizza(pizza);
    // validate that payment has each field populated
    if ((Object.keys(payment).length === 0) || !payment.token || !payment.amount || !payment.currency) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "ERROR_400_BAD_REQUEST: Invalid payment information." })
      };
    }
    // validate the token (36 character string)
    if (payment.token.substring(20).length !== 36) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "ERROR_400_BAD_REQUEST: Invalid payment token." })
      };
    }
    // validate price is positive
    if (payment.amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "ERROR_400_BAD_REQUEST: Invalid payment amount." })
      };
    }

    // create an new orderId for the order.
    let orderId = crypto.randomUUID();
    let status = "confirmed";

    const order = {
      orderId: orderId,
      status: status,
      paidAmount: payment.amount,
      items: pizza
    }

    let orderParams = {
      TableName: "Orders",
      Item: order
    }

    // store order details dyanmoDB local docker container?
    const ddb = new AWS.DynamoDB.DocumentClient({
      endpoint: "http://dynamodb-local:8000",
      region: "us-east-1",
      accessKeyId: "dummy",
      secretAccessKey: "dummy"
    });

    // Check if Orders table exists, create one if DNE.
    async function tableExists() {
      const tableName = "Orders";
      const db = new AWS.DynamoDB({
        endpoint: "http://dynamodb-local:8000",
        region: "us-east-1",
        accessKeyId: "dummy",
        secretAccessKey: "dummy"
      });
      try {
        await db.describeTable({ TableName: tableName }).promise();
        console.log(`${tableName} Table found!`);
      } catch (err) {
        if (err.code === "ResourceNotFoundException") {
          console.log(`${tableName} table does not exist. Creating New ${tableName} Table`);
          const dbParams = {
            TableName: tableName,
            AttributeDefinitions: [
              { AttributeName: "orderId", AttributeType: "S" }
            ],
            KeySchema: [
              { AttributeName: "orderId", KeyType: "HASH" }
            ],
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
            }
          }
          await db.createTable(dbParams).promise();
          console.log(`Successfully created ${tableName} table.`);
          return;
        } else {
          throw err;
        }
      }
    }

    await tableExists();

    // Save order to db
    try {
      console.log("Saving order to DB...");
      await ddb.put(orderParams).promise();
      console.log("Successfully upserted order to DB.");
    } catch (err) {
      console.error("ERROR_500_INTERNAL: Error upserting order to DB.", err);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "ERROR_500_INTERNAL: Failed to write order." })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        order: order,
        message: "Payment processed successfully and order placed."
      })
    };
  }

  // View an order
  if (httpMethod === "GET" && path.startsWith("/order/")) {
    const orderId = path.split("/")[2];
    console.log("OrderId:", orderId);
    const ddb = new AWS.DynamoDB.DocumentClient({
      endpoint: "http://dynamodb-local:8000",
      region: "us-east-1",
      accessKeyId: "dummy",
      secretAccessKey: "dummy"
    });

    const params = {
      TableName: "Orders",
      Key: {
        orderId: orderId
      }
    }

    let order;

    console.log("Retrieving order from DB...");
    try {
      const result = await ddb.get(params).promise();
      if (result.Item) {
        console.log("Retrieved order:", result.Item);
        order = result.Item;
      } else {
        console.log("Order not found");
      }
    } catch (err) {
      console.log("Error retrieving order:", err);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Retrieved Order Details Successfully",
        order: order
      })
    };
  }

  /*
  * Get an example of a customized pizza ready to order (for dev purposes)
  */
  if (httpMethod === "GET" && path === "/example_order") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        size: "medium",
        crust: "stuffed",
        sauce: "regular",
        cheese: "extra",
        toppings: {
          meats: ["pepperoni"],
          vegetables: ["mushrooms", "olives"]
        },
        price: 14.61,
        calories: 1850,
        payment: {
          token: "pizza_payment_token_" + crypto.randomUUID(),
          amount: 14.61,
          currency: "USD"
        },
        customer: {
          name: "Giorno",
          customerId: "customer_" + crypto.randomUUID(),
          email: "giorno@email.com"
        }
      })
    };
  }

  const response = {
    statusCode: 404,
    body: JSON.stringify({
      message: "ERROR_404_NOT_FOUND",
    })
  };

  return response;
};

function validatePizza(pizza) {
  console.log("Validating pizza...");
  if ((Object.keys(pizza).length === 0) || !pizza.size || !pizza.sauce || !pizza.cheese) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "ERROR_400_BAD_REQUEST: Invalid pizza provided." })
    };
  }
  console.log("Pizza validated successfully! Hey... You've got great taste!");
}

function calculatePrice(pizza) {
  let calculatedPrice = 0;
  const priceDivisor = 11;
  const pricePerTopping = 2;
  const numFreeToppings = 1; // Customers get one free topping with any pizza
  const sizeRadius = {
    "small": 5,
    "medium": 6,
    "large": 7,
    "xlarge": 8
  };
  let radius = sizeRadius[pizza.size];
  let toppingsPrice = pricePerTopping * (
    (pizza.toppings.meat?.length || 0) +
    (pizza.toppings.vegetables?.length || 0) -
    numFreeToppings
  );

  if (pizza.cheese === "extra") {
    toppingsPrice = toppingsPrice + pricePerTopping;
  }

  calculatedPrice = (
    (
      (Math.PI * Math.pow(radius, 2)) / priceDivisor
    ) + toppingsPrice
  ).toFixed(2);

  return calculatedPrice;
}

function calculateCalories(pizza) {
  const sizeBaseCalories = {
    "small": 1200,
    "medium": 1600,
    "large": 2200,
    "xlarge": 2600
  };

  const meatCalories = 200;
  const vegCalories = 25;
  let numMeatToppings = pizza.toppings.meats?.length || 0;
  let numVegToppings = pizza.toppings.vegetables?.length || 0;
  let totalMeatCalories = meatCalories * numMeatToppings;
  let totalVegCalories = vegCalories * numVegToppings;

  let totalCalories = sizeBaseCalories[pizza.size] + totalMeatCalories + totalVegCalories;
  return totalCalories;
}
