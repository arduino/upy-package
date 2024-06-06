export function highlightPattern(text, pattern) {
    const highlightColor = '\x1b[38;2;82;140;227m'; // ANSI escape code for a bright red foreground color
    const boldFormatting = '\x1b[1m'; // ANSI escape code for bold formatting
    const resetColorAndFormat = '\x1b[0m'; // ANSI escape code to reset color and formatting
    const regex = new RegExp(pattern, 'gi');
    return text.replace(regex, match => `${boldFormatting}${highlightColor}${match}${resetColorAndFormat}`);
}

export function truncateDescription(description, pattern, maxLength = 80) {
    const patternIndex = description.toLowerCase().indexOf(pattern.toLowerCase());
    const patternLength = pattern.length;
    const patternStartIndex = Math.max(0, patternIndex - Math.floor((maxLength - patternLength) / 2));
    const patternEndIndex = Math.min(description.length, patternStartIndex + maxLength - patternLength);
    let truncatedDescription = description.substring(patternStartIndex, patternEndIndex);

    if (patternStartIndex > 0) {
        truncatedDescription = `...${truncatedDescription}`;
    }
    if (patternEndIndex < description.length) {
        truncatedDescription = `${truncatedDescription}...`;
    }
    return truncatedDescription;
}

export function printPackagesWithHighlights(packages, pattern) {
    if (packages && packages.length > 0) {
        for (const [index, pkg] of packages.entries()) {
            const { name, description, tags } = pkg;
            const highlightedName = highlightPattern(name, pattern);
            console.log(`📦 ${highlightedName}`);

            if (description && description.toLowerCase().includes(pattern)) {
                let truncatedDescription = truncateDescription(description, pattern);
                truncatedDescription = highlightPattern(truncatedDescription, pattern); // Highlight pattern in truncated description
                console.log(`📝 ${truncatedDescription}`);
            }

            if (tags && tags.length > 0) {
                const matchingTags = tags.filter(tag => tag.toLowerCase().includes(pattern));
                if (matchingTags.length > 0) {
                    const highlightedTags = matchingTags.map(tag => highlightPattern(tag, pattern));
                    console.log(`🔖 [${highlightedTags.join(', ')}]`);
                }
            }

            // Add an empty line if it's not the last package
            if (index < packages.length - 1) {
                console.log(); // Print an empty line
            }
        }
    } else {
        console.log(`🤷 No matching packages found.`);
    }
}