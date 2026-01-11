const https = require('https');
const fs = require('fs');

const url = "https://nregastrep.nic.in/netnrega/materialwise_exp.aspx?lflag=eng&flg=v&state_code=16&state_name=KERALA&page=s&fin_year=2025-2026&Digest=iGHV9dpfm0nO4UVhdORvSQ";

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        // Simple regex to find links since we might not have cheerio in this context (or to keep it simple)
        const links = [];
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(data)) !== null) {
            links.push({ href: match[1], text: match[2].replace(/<[^>]+>/g, '').trim() });
        }

        console.log("Total Links Found:", links.length);
        console.log("First 10 Links:");
        console.log(links.slice(0, 10));

        const districtLinks = links.filter(l => l.text.toLowerCase().includes('kozhikode'));
        console.log("\nDistrict Links (Kozhikode):");
        console.log(districtLinks);
    });
}).on('error', (err) => {
    console.error("Error:", err.message);
});
