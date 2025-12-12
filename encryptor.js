
const fs = require('fs');
const encrypt = (text) => {
    // Simple Caesar shift + Base64
    let shifted = text.split('').map(c => String.fromCharCode(c.charCodeAt(0) + 42)).join('');
    return Buffer.from(shifted).toString('base64');
}

const texts = {
    title: "✨ Happy Birthday Diksha! ✨",
    body: "Wishing you lots of happiness, good health, and success. Have an amazing year ahead and enjoy your day!\n                😊✨ ❤️",
    sig: "~ Dhruv Varia",
    locked: "When you are reading this msg i think long time has been passed. while writing this message yes still today i have same feelings for you as we have met first time. i always hoping that we will be partners for life. but life has always played with me. 2020 - 2025 was my worst years i've faced. this is the last december now i will fool my heart to move on. but my feelings will always stays with me until im alive. i will always remember you. >3"
};

let output = "";
for (let [k, v] of Object.entries(texts)) {
    // One key per line
    output += `${k}::::${encrypt(v)}\n`;
}

fs.writeFileSync('output_keys.txt', output, 'utf8');
console.log("Done writing keys.");
