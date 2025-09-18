import util from "util";

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

  // View the Menu
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

  // Customize a pizza
  if (httpMethod === "POST" && path === "/customize") {
    // Parse the JSON
    const pizza = JSON.parse(event.body || {});
    console.log("Parsed body:", util.inspect(pizza, { depth: null }));
    
    // Make sure pizza is valid
    console.log("Validating pizza...");
    if ((Object.keys(pizza).length === 0) || !pizza.size || !pizza.sauce || !pizza.cheese) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "ERROR_400_BAD_REQUEST: Invalid pizza provided." })
      };
    }
    console.log("Pizza validated successfully! Hey... You've got great taste!");


    // Calculate Price
    let calculatedPrice = 0;
    // Caclulate Calories
    let calculatedCalories = 0;

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
          price: calculatedPrice,
          calories: calculatedCalories
      })
    };
  }

  // Place an Order
  if (httpMethod === "POST" && path === "/order") {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "PLACING ORDER..." })
    };
  }

  // View an order
  if (httpMethod === "GET" && path === "order/id") {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "RETRIEVING ORDER DETAILS..." })
    };
  }

  // Get an example of a customized pizza (for dev purposes)
  if (httpMethod === "GET" && path === "/customize_example") {
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
