const PII_PATTERNS = [
    // Email addresses
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Phone numbers 
    /(\+\d{1,2}[\s\.-]?)?\(?\d{3}\)?[\s\.-]?\d{3}[\s\.-]?\d{4}/g,

    // Common social domains
    /\b(gmail\.com|hotmail\.com|yahoo\.com|linkedin\.com|instagram\.com|facebook\.com|telegram\.me|whatsapp\.com|skype)\b/gi,

    // @ handles
    /@\w+/g
]

function containsDisallowedContent(text)
{
    if(!text) return false;

    for(const pattern of PII_PATTERNS)
    {
        if(pattern.test(text))
        {
            console.warn(`Disallowed content detected: ${text.match(pattern)}`);
            return true;
        }
    }

    return false;
}

module.exports = {containsDisallowedContent};