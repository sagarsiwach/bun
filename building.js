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
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    console.error(`Invalid URL: ${url}`);
    return Promise.reject(new Error("Invalid URL")); // Early return on invalid URL
  }

  options.agent = httpsAgent; // Use the custom HTTPS agent for pooling
  options.headers = {
    ...options.headers,
    Cookie: cookies,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.112 Safari/537.36",
    Referer: base_url,
    ...options.headers,
  };

  console.log(`Making request to URL: ${url}`); // Log the URL to diagnose issues
  const response = await fetch(url, options);
  if (!response.ok) {
    console.error(`HTTP error! Status: ${response.status} for URL: ${url}`);
    throw new Error(`Request failed with status ${response.status}`);
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

const buildNewBuilding = async (pid, bid) => {
  try {
    console.log(
      `======= Building new building (pid: ${pid}, bid: ${bid}) =======`
    );

    // Navigate to build.php?id=<pid>
    let pageContent = await makeRequest(`${base_url}/build.php?id=${pid}`, {
      method: "GET",
    });

    const $ = cheerio.load(pageContent);
    let buildingLinkFound = false;
    let buildUrl = "";

    // Check if the building link with the specific pid and bid is present
    $("a").each(function () {
      const href = $(this).attr("href");
      if (href && href.includes(`id=${pid}`) && href.includes(`b=${bid}`)) {
        buildingLinkFound = true;
        buildUrl = `${base_url}/${href}`;
        return false; // break the loop once the building link is found
      }
    });

    if (buildingLinkFound) {
      console.log("Build URL:", buildUrl); // Print the build URL
      // Make a GET request to the constructed URL to build the new building
      let response = await makeRequest(buildUrl, { method: "GET" });
      // console.log("Response Body:", response); // Print the response body
      console.log(
        `New building (pid: ${pid}, bid: ${bid}) built successfully!`
      );
    } else {
      console.log(
        `Building link not found for pid: ${pid}, bid: ${bid}. Assuming building is already constructed.`
      );
    }
  } catch (error) {
    console.error(
      `Error building new building (pid: ${pid}, bid: ${bid}):`,
      error
    );
  }
};

const upgradeBuilding = async (pid, bid, loop) => {
  try {
    console.log(
      `======= Upgrading building (pid: ${pid}, bid: ${bid}) =======`
    );

    // Function to fetch the upgrade link with the new CSRF token
    const fetchUpgradeLink = async () => {
      let pageContent = await makeRequest(`${base_url}/build.php?id=${pid}`, {
        method: "GET",
      });
      const $ = cheerio.load(pageContent);

      // Find the specific upgrade link that includes both the pid and the CSRF token
      const linkElement = $(
        `a[href*='village2.php?id=${pid}'][href*='&k=']`
      ).first();
      if (linkElement.length) {
        const upgradeLink = `${base_url}/${linkElement.attr("href")}`;
        console.log(`Found upgrade link: ${upgradeLink}`);
        return upgradeLink;
      } else {
        console.error(
          "No valid upgrade link found. Unable to proceed with the upgrade."
        );
        return null; // Optionally, throw an error or handle this case as needed
      }
    };

    // Check if the building is already at its maximum level before starting upgrades
    let pageContent = await makeRequest(`${base_url}/build.php?id=${pid}`, {
      method: "GET",
    });
    const $initial = cheerio.load(pageContent);
    const isMaxLevel =
      $initial(".none").text().includes("Updated") &&
      $initial(".none").text().includes("Fully");

    if (!isMaxLevel) {
      for (let i = 0; i < loop; i++) {
        // Fetch a new CSRF token and upgrade link for each iteration
        const upgradeLink = await fetchUpgradeLink();
        if (upgradeLink) {
          await makeRequest(upgradeLink, { method: "GET" });
          console.log(
            `Building (pid: ${pid}, bid: ${bid}) upgraded to level ${
              i + 1
            }/${loop}`
          );
        } else {
          console.log(
            "Failed to retrieve a valid upgrade link. Stopping upgrades."
          );
          break; // Exit the loop if no valid link is found
        }
      }
      console.log(
        `Building (pid: ${pid}, bid: ${bid}) upgraded to the desired level (${loop})!`
      );
    } else {
      console.log(
        `Building (pid: ${pid}, bid: ${bid}) is already at the maximum level.`
      );
    }
  } catch (error) {
    console.error(
      `Error upgrading building (pid: ${pid}, bid: ${bid}):`,
      error
    );
  }
};

const upgradeResourceField = async (pid, loop) => {
  try {
    console.log(`======= Upgrading resource field (pid: ${pid}) =======`);

    // Function to fetch the upgrade link with the new CSRF token
    const fetchUpgradeLink = async () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        let pageContent = await makeRequest(`${base_url}/build.php?id=${pid}`, {
          method: "GET",
        });
        const $ = cheerio.load(pageContent);
        const upgradeLink = $("a.build").attr("href");
        if (upgradeLink && upgradeLink.includes("k=")) {
          return `${base_url}/${upgradeLink}`;
        } else if (attempt < 5) {
          console.log(
            `Attempt ${attempt}: No valid upgrade link found. Retrying in 2 seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for 2 seconds before retrying
        }
      }
      console.error(
        "Failed to retrieve a valid upgrade link after multiple attempts."
      );
      return null; // Return null or throw an error depending on your error handling strategy
    };

    // Fetch the initial content to determine the current level
    let initialContent = await makeRequest(`${base_url}/build.php?id=${pid}`, {
      method: "GET",
    });
    const $initial = cheerio.load(initialContent);
    const currentLevel = parseInt(
      $initial("span.level").text().replace("level ", ""),
      10
    );

    const maxLevel = 30; // Define the maximum level for a resource field
    if (currentLevel >= maxLevel) {
      console.log(
        `Resource field (pid: ${pid}) is already at the maximum level (${maxLevel}).`
      );
      return; // Exit function if current level is already at or above max level
    }

    const levelsToUpgrade = Math.min(loop, maxLevel - currentLevel); // Determine the number of levels to upgrade without exceeding the max level

    for (let i = 0; i < levelsToUpgrade; i++) {
      const upgradeLink = await fetchUpgradeLink();
      if (upgradeLink) {
        await makeRequest(upgradeLink, { method: "GET" });
        console.log(
          `Resource field (pid: ${pid}) upgraded to level ${
            currentLevel + i + 1
          }`
        );
      } else {
        console.log(
          "Failed to retrieve a valid upgrade link after retries. Stopping upgrades."
        );
        break; // Exit the loop if no valid link is found
      }
    }

    console.log(
      `Resource field (pid: ${pid}) upgraded to the desired level (${
        currentLevel + levelsToUpgrade
      })!`
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
          `Upgrading resource field at position ${pid} to level ${loop}`
        );
        await upgradeResourceField(pid, loop);
      } else {
        // For pids greater than 18, first construct the building if not already present
        console.log(
          `Building/upgrading building at position ${pid} with building ID ${bid}`
        );
        // Check if building needs to be constructed first
        await buildNewBuilding(pid, bid); // This assumes building is needed; additional logic may be required to check if building already exists

        // Once building is constructed, proceed with upgrades
        if (loop > 1) {
          // If loop > 1, it means upgrades are required beyond initial construction
          console.log(
            `Upgrading building at position ${pid} with building ID ${bid} up to level ${loop}`
          );
          await upgradeBuilding(pid, bid, loop);
        }
      }
    }
  } else {
    console.error("Failed to execute login flow. Stopping execution.");
  }
};

main().catch(console.error);
