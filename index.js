import fetch from "node-fetch";
import cheerio from "cheerio";

const base_url = "https://gotravspeed.com";
const username = "scar"; // Replace with your actual username
const password = "satkabir"; // Replace with your actual password

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.112 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-User": "?1",
  "Sec-Fetch-Dest": "document",
  Referer: base_url,
  "Upgrade-Insecure-Requests": "1",
  "Content-Type": "application/x-www-form-urlencoded",
};

async function login() {
  try {
    const loginPayload = {
      name: username,
      password: password,
    };

    const loginResponse = await fetch(`${base_url}/path/to/login`, {
      method: "POST",
      headers,
      body: new URLSearchParams(loginPayload),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${await loginResponse.text()}`);
    }

    const cookies = loginResponse.headers.get("set-cookie"); // Assume server sets cookie
    console.log("Login successful");
    return cookies;
  } catch (error) {
    console.error("Error during login:", error);
    return null;
  }
}

async function performAction(url, actionPayload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, Cookie: actionPayload.cookies },
    body: new URLSearchParams(actionPayload.data),
  });

  if (!response.ok)
    throw new Error(`Failed to perform action: ${await response.text()}`);
  return await response.text();
}

async function increaseProduction(loopCount, cookies) {
  for (let i = 0; i < loopCount; i++) {
    const responseText = await fetch(`${base_url}/buy2.php?t=0`, {
      headers: { ...headers, Cookie: cookies },
    });
    const $ = cheerio.load(await responseText.text());
    const key = $('input[name="key"]').val();

    if (!key) {
      console.error("Failed to find key for increasing production.");
      break; // Or handle re-login/retry logic
    }

    const data = {
      selected_res: 4,
      "g-recaptcha-response": "xxxx",
      xor: 100,
      key: key,
    };

    console.log(
      "Production increased",
      await performAction(`${base_url}/buy2.php?t=0&Shop=done`, {
        data,
        cookies,
      })
    );
  }
}

async function increaseStorage(loopCount, cookies) {
  for (let i = 0; i < loopCount; i++) {
    const responseText = await fetch(`${base_url}/buy2.php?t=2`, {
      headers: { ...headers, Cookie: cookies },
    });
    const $ = cheerio.load(await responseText.text());
    const key = $('input[name="key"]').val();

    if (!key) {
      console.error("Failed to find key for increasing storage.");
      break; // Or handle re-login/retry logic
    }

    const data = {
      selected_res: 4,
      "g-recaptcha-response": "xxxx",
      xor: 100,
      key: key,
    };

    console.log(
      "Storage increased",
      await performAction(`${base_url}/buy2.php?t=2&Shop=done`, {
        data,
        cookies,
      })
    );
  }
}

async function main(action, loopCount) {
  const cookies = await login();
  if (!cookies) return;

  if (action === "production") {
    await increaseProduction(loopCount, cookies);
  } else if (action === "storage") {
    await increaseStorage(loopCount, cookies);
  }
}

// Example calls
main("production", 5); // To increase production 5 times
// main("storage", 5);    // To increase storage 5 times
