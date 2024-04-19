import fetch from "node-fetch";
import cheerio from "cheerio";
import https from "https";

const USERNAME = "scar";
const PASSWORD = "satkabir";
let EnableDebugging = false; // Set to false to disable response logging
const base_url = "https://gotravspeed.com"; // Define the base URL for the site
let cookies = "";

// Create a custom HTTPS agent with connection pooling
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10, // Maximum number of sockets per host
  keepAliveMsecs: 30000, // Keep alive time in milliseconds
});

const handleSetCookieHeader = (setCookieHeaders) => {
  setCookieHeaders?.forEach((header) => {
    const [cookie] = header.split(";");
    const [name, value] = cookie.split("=");
    cookies += `${name}=${value}; `;
  });
};

const makeRequest = async (url, options) => {
  options.agent = httpsAgent; // Use the custom HTTPS agent for pooling
  options.headers = {
    ...options.headers,
    Cookie: cookies,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.112 Safari/537.36",
    Referer: base_url,
    ...options.headers,
  };
  const response = await fetch(url, options);
  if (!response.ok) {
    console.error(`HTTP error! Status: ${response.status}`);
    throw new Error("Request failed");
  }
  handleSetCookieHeader(response.headers.get("set-cookie")?.split(","));
  const data = await response.text();
  if (EnableDebugging) {
    const $ = cheerio.load(data);
    const bodyContent = $("body").html();
    console.log("Response:", bodyContent);
  }
  return data;
};

const executeLoginFlow = async () => {
  try {
    console.log("======= Step 1: Fetch login page =======");
    await makeRequest("https://gotravspeed.com", { method: "GET" });
    console.log("Fetch login page successful");

    console.log("======= Step 2: Post login credentials =======");
    let result = await makeRequest("https://gotravspeed.com", {
      method: "POST",
      body: `name=${encodeURIComponent(USERNAME)}&password=${encodeURIComponent(
        PASSWORD
      )}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (result.includes("Login failed")) {
      console.error("Login failed due to incorrect credentials");
      return false;
    }
    console.log("Login successful");

    console.log("======= Step 3: Select a server =======");
    await makeRequest("https://gotravspeed.com/game/servers", {
      method: "POST",
      body: "action=server&value=9",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log("Server selection successful");

    console.log("======= Step 4: Log into the selected server =======");
    await makeRequest("https://gotravspeed.com/game/servers", {
      method: "POST",
      body: "action=serverLogin&value[pid]=12&value[server]=9",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log("Server login successful");

    console.log("======= Step 5: Navigate to village1.php =======");
    await makeRequest("https://fun.gotravspeed.com/village1.php", {
      method: "GET",
    });
    console.log("Navigation to village1.php successful");

    return true; // Ensure to return true explicitly here
  } catch (error) {
    console.error("An error occurred:", error);
    return false; // Return false on error
  }
};

const increaseProduction = async () => {
  try {
    // Fetch the buy2.php page to extract the CSRF token
    let pageContent = await makeRequest(
      "https://fun.gotravspeed.com/buy2.php",
      {
        method: "GET",
      }
    );

    // Use cheerio to parse the HTML and extract the CSRF token
    const $ = cheerio.load(pageContent);
    const key = $("input[name='key']").val(); // Correctly locating the key assuming the provided HTML structure

    if (!key) {
      console.error("CSRF token not found");
      return;
    }

    // Prepare data for POST request to increase production
    const postData = `selected_res=4&g-recaptcha-response=xxxx&xor=100&key=${encodeURIComponent(
      key
    )}`;

    // Execute the POST request to increase production
    await makeRequest("https://fun.gotravspeed.com/buy2.php?t=0&Shop=done", {
      method: "POST",
      body: postData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    // Log the timestamp and message only
    console.log(`${new Date().toISOString()} - Production Increased`);
  } catch (error) {
    console.error(
      "An error occurred while trying to increase production:",
      error
    );
  }
};

const increaseProductionConcurrently = async () => {
  const promises = [];
  for (let i = 0; i < 10; i++) {
    // Adjust the number for parallel executions
    promises.push(increaseProductionWithNewToken());
  }
  await Promise.all(promises);
};

const increaseProductionWithNewToken = async () => {
  // Fetch the page to extract a fresh CSRF token for each request
  let pageContent = await makeRequest("https://fun.gotravspeed.com/buy2.php", {
    method: "GET",
  });
  const $ = cheerio.load(pageContent);
  const key = $("input[name='key']").val();

  if (!key) {
    console.error("CSRF token not found");
    return;
  }

  // Now use this token to make a request
  const postData = `selected_res=4&g-recaptcha-response=xxxx&xor=100&key=${encodeURIComponent(
    key
  )}`;
  await makeRequest("https://fun.gotravspeed.com/buy2.php?t=0&Shop=done", {
    method: "POST",
    body: postData,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  console.log(`${new Date().toISOString()} - Production Increased`);
};

// Example usage in the main function
const main = async () => {
  if (await executeLoginFlow()) {
    for (let i = 0; i < 10000; i++) {
      // Adjust loop for desired number of iterations
      // console.log(`Attempt ${i + 1} to increase production`);
      await increaseProduction(); // Single production increase per iteration
    }
  } else {
    console.error("Failed to execute login flow. Stopping execution.");
  }
};

main().catch(console.error);
