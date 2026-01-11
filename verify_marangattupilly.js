const cheerio = require('cheerio');
const https = require('https');

const BASE_URL = 'https://nregastrep.nic.in/netnrega/';
const START_URL = 'https://nregastrep.nic.in/netnrega/materialwise_exp.aspx?lflag=eng&flg=v&state_code=16&state_name=KERALA&page=s&fin_year=2025-2026&Digest=iGHV9dpfm0nO4UVhdORvSQ';

const TARGET_DISTRICT = 'KOTTAYAM';
const TARGET_BLOCK = 'UZHAVOOR';
const TARGET_PANCHAYAT = 'MARANGATTUPILLY';

// Cookie jar
let cookieStore = [];

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const opts = new URL(url);
        const options = {
            hostname: opts.hostname,
            path: opts.pathname + opts.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Cookie': cookieStore.join('; ')
            }
        };

        const req = https.request(options, (res) => {
            // Update cookies
            const setCookie = res.headers['set-cookie'];
            if (setCookie) {
                setCookie.forEach(c => {
                    const part = c.split(';')[0];
                    if (!cookieStore.includes(part)) cookieStore.push(part);
                });
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', e => reject(e));
        req.end();
    });
}

function findLink($doc, text) {
    const searchText = text.toLowerCase().trim();
    let targetHref = null;
    $doc('a').each((i, el) => {
        const linkText = $doc(el).text().toLowerCase().trim();
        if (linkText === searchText || linkText.includes(searchText)) {
            targetHref = $doc(el).attr('href');
            return false;
        }
    });
    return targetHref;
}

async function run() {
    try {
        console.log(`1. Fetching Start URL...`);
        let html = await fetchUrl(START_URL);
        let $ = cheerio.load(html);

        console.log(`2. Looking for District: ${TARGET_DISTRICT}`);
        let href = findLink($, TARGET_DISTRICT);
        if (!href) {
            console.error('District not found!');
            // Log available
            console.log('Available:', $('table a').map((i, el) => $(el).text().trim()).get().slice(0, 10));
            return;
        }
        let nextUrl = new URL(href, BASE_URL).toString();
        console.log(`-> Found. Navigating to: ${nextUrl}`);

        html = await fetchUrl(nextUrl);
        $ = cheerio.load(html);

        console.log(`3. Looking for Block: ${TARGET_BLOCK}`);
        href = findLink($, TARGET_BLOCK);
        if (!href) {
            console.error('Block not found!');
            console.log('Available Blocks:', $('table a').map((i, el) => $(el).text().trim()).get().slice(0, 10));
            return;
        }
        nextUrl = new URL(href, BASE_URL).toString();
        console.log(`-> Found. Navigating to: ${nextUrl}`);

        html = await fetchUrl(nextUrl);
        $ = cheerio.load(html);

        console.log(`4. Looking for Panchayat: ${TARGET_PANCHAYAT}`);
        href = findLink($, TARGET_PANCHAYAT);
        if (!href) {
            console.error('Panchayat not found!');
            console.log('Available Panchayats:', $('table a').map((i, el) => $(el).text().trim()).get().slice(0, 10));
            return;
        }
        nextUrl = new URL(href, BASE_URL).toString();
        console.log(`-> Found. Navigating to: ${nextUrl}`);

        html = await fetchUrl(nextUrl);
        $ = cheerio.load(html);

        console.log(`5. Extracting Table Data...`);
        let rowsFound = 0;
        $('tr').each((i, el) => {
            const cells = $(el).find('td');
            if (cells.length >= 3) {
                const rowText = cells.map((j, c) => $(c).text().trim()).get().join('\t');
                if (rowsFound < 5) console.log(rowText); // Print first 5 rows
                rowsFound++;
            }
        });

        console.log(`\nSuccess! Extracted ${rowsFound} rows of data.`);

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
