import fetch from "node-fetch";
import cheerio from "cheerio";
import https from "https";
import fs from "fs"; // Import file system module to read the JSON file

// Read JSON data from config.json
const configPath = "./config.json"; // Adjust the path as necessary
const rawConfig = fs.readFileSync(configPath);
const config = JSON.parse(rawConfig);

const USERNAME = "scar";
const PASSWORD = "satkabir";
let EnableDebugging = false; // Set to true to enable response logging
const base_url = "https://fun.gotravspeed.com"; // Base URL for the site
let cookies = "";

// Now use config to access your building data
const buildingData = config.buildingData;
console.log(buildingData);

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
        PASSWORD,
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

const buildNewBuilding = async (pid, bid) => {
  try {
    console.log(
      `======= Building new building (pid: ${pid}, bid: ${bid}) =======`,
    );

    // Navigate to build.php?id=<pid>
    let pageContent = await makeRequest(`${base_url}/build.php?id=${pid}`, {
      method: "GET",
    });

    // Extract the CSRF token (k=<token>) from the response
    const $ = cheerio.load(pageContent);
    const csrfToken = $("a.build")
      .attr("href")
      .match(/k=(\w+)/)[1];

    // Construct the URL for building the new building
    const buildUrl = `${base_url}/village2.php?id=${pid}&b=${bid}&k=${csrfToken}`;

    console.log("Build URL:", buildUrl); // Print the build URL

    // Make a GET request to the constructed URL to build the new building
    let response = await makeRequest(buildUrl, { method: "GET" });
    console.log("Response Body:", response); // Print the response body
    console.log(`New building (pid: ${pid}, bid: ${bid}) built successfully!`);
  } catch (error) {
    console.error(
      `Error building new building (pid: ${pid}, bid: ${bid}):`,
      error,
    );
  }
};

const upgradeBuilding = async (pid, bid, loop) => {
  try {
    console.log(
      `======= Upgrading building (pid: ${pid}, bid: ${bid}) =======`,
    );

    // Navigate to build.php?id=<pid>
    let pageContent = await makeRequest(`${base_url}/build.php?id=${pid}`, {
      method: "GET",
    });

    // Extract the upgrade link from the response
    const $ = cheerio.load(pageContent);
    const upgradeLink = $("a.build").attr("href");

    // Check if the building is already at the maximum level
    const isMaxLevel =
      $(".none").text().includes("Updated") &&
      $(".none").text().includes("Fully");

    if (!isMaxLevel) {
      for (let i = 0; i < loop; i++) {
        // Make a GET request to the upgrade link
        await makeRequest(`${base_url}/${upgradeLink}`, { method: "GET" });
        console.log(
          `Building (pid: ${pid}, bid: ${bid}) upgraded to level ${i + 1}/${loop}`,
        );
      }
      console.log(
        `Building (pid: ${pid}, bid: ${bid}) upgraded to the desired level (${loop})!`,
      );
    } else {
      console.log(
        `Building (pid: ${pid}, bid: ${bid}) is already at the maximum level.`,
      );
    }
  } catch (error) {
    console.error(
      `Error upgrading building (pid: ${pid}, bid: ${bid}):`,
      error,
    );
  }
};

const upgradeResourceField = async (pid, loop) => {
  try {
    console.log(`======= Upgrading resource field (pid: ${pid}) =======`);

    // Navigate to build.php?id=<pid>
    let pageContent = await makeRequest(`${base_url}/build.php?id=${pid}`, {
      method: "GET",
    });

    // Extract the upgrade link from the response
    const $ = cheerio.load(pageContent);
    const upgradeLink = $("a.build").attr("href");

    for (let i = 0; i < loop; i++) {
      // Make a GET request to the upgrade link
      await makeRequest(`${base_url}/${upgradeLink}`, { method: "GET" });
      console.log(
        `Resource field (pid: ${pid}) upgraded to level ${i + 1}/${loop}`,
      );
    }
    console.log(
      `Resource field (pid: ${pid}) upgraded to the desired level (${loop})!`,
    );
  } catch (error) {
    console.error(`Error upgrading resource field (pid: ${pid}):`, error);
  }
};

const main = async () => {
  if (await executeLoginFlow()) {
    const { construction } = buildingData.building[0];

    // Process tasks based on pid values
    for (const { pid, bid, loop } of construction) {
      if (pid <= 18) {
        // Execute resource field logic for pids less than or equal to 18
        console.log(
          `Upgrading resource field at position ${pid} to level ${loop}`,
        );
        await upgradeResourceField(pid, loop);
      } else {
        // Execute building logic for pids greater than 18
        console.log(
          `Building/upgrading building at position ${pid} with building ID ${bid}`,
        );
        await upgradeBuilding(pid, bid, loop);
      }
    }
  } else {
    console.error("Failed to execute login flow. Stopping execution.");
  }
};

main().catch(console.error);
