import express from "express";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import fs from "fs";

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3100;
const username = "imposterx.com.in";
const password = "imposter@15#12";
const cookiesFilePath = "./instagram_cookies.json";

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

const parseNumber = (value) => {
  if (!value) return 0;
  if (value.includes("M")) return parseFloat(value) * 1_000_000;
  if (value.includes("K")) return parseFloat(value) * 1_000;
  return parseInt(value.replace(/[^0-9]/g, "")) || 0;
};

const scrapeInstagram = async (profileUrl) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 800 });

  if (fs.existsSync(cookiesFilePath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, "utf8"));
    await page.setCookie(...cookies);
  }

  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "networkidle2",
  });

  if (page.url() !== "https://www.instagram.com/") {
    await page.waitForSelector('input[name="username"]', { visible: true });
    await page.type('input[name="username"]', username);
    await page.type('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2));
  }

  await page.goto(profileUrl, { waitUntil: "networkidle2" });
  await page.waitForSelector("body");

  const htmlContent = await page.content();
  const $ = cheerio.load(htmlContent);

  const stats = $("header").find("span.x5n08af");
  const fullName = $("header").find("span.x1lliihq").eq(1).text().trim();
  const wordCount = fullName.split(/\s+/).length;

  const username = profileUrl.split("instagram.com/")[1].split("/")[0];
  const numericCount = (username.match(/\d/g) || []).length;
  const nplu = numericCount / username.length;

  const nums = (fullName.match(/\d/g) || []).length;
  const nplfn = nums / fullName.length;

  const descElement = $("header").find("span._ap3a");
  const desc = descElement.length ? descElement.text().trim() : "";
  const decL = desc.length ;

  const profileImageExists = $("._aagu").length > 0;
  const privateAcc = profileImageExists ? 0 : 1;

  const posts = parseNumber($(stats[0]).text());
  const followers = parseNumber($(stats[1]).text());
  const following = parseNumber($(stats[2]).text());

  await browser.close();

  return [
    nplu,
    wordCount,
    nplfn,
    // decL,
    privateAcc,
    posts,
    followers,
    following,
  ];
};

app.get("/api", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Hi!, welcome to puppeteer",
  });
});

app.post("/scrape", async (req, res) => {
  const { profile } = req.body;
  if (!profile) {
    return res.status(400).json({ error: "Profile URL is required" });
  }

  try {
    const data = await scrapeInstagram(profile);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to scrape profile", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
