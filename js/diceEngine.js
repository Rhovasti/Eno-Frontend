// Dice rolling engine
class DiceEngine {
    // Parse dice notation (e.g., "2d6+3", "1d20-2", "3d8")
    static parseDiceNotation(notation) {
        const regex = /^(\d+)d(\d+)([+-]\d+)?$/i;
        const match = notation.replace(/\s/g, '').match(regex);
        
        if (!match) {
            throw new Error('Invalid dice notation. Use format like "2d6+3" or "1d20"');
        }
        
        return {
            count: parseInt(match[1]),
            sides: parseInt(match[2]),
            modifier: match[3] ? parseInt(match[3]) : 0
        };
    }
    
    // Roll a single die
    static rollDie(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }
    
    // Roll multiple dice and return detailed results
    static roll(notation) {
        const { count, sides, modifier } = this.parseDiceNotation(notation);
        
        if (count < 1 || count > 100) {
            throw new Error('Number of dice must be between 1 and 100');
        }
        
        if (sides < 2 || sides > 1000) {
            throw new Error('Number of sides must be between 2 and 1000');
        }
        
        const rolls = [];
        let subtotal = 0;
        
        for (let i = 0; i < count; i++) {
            const result = this.rollDie(sides);
            rolls.push(result);
            subtotal += result;
        }
        
        const total = subtotal + modifier;
        
        return {
            notation,
            count,
            sides,
            modifier,
            rolls,
            subtotal,
            total,
            summary: `${notation} = [${rolls.join(', ')}]${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''} = ${total}`
        };
    }
    
    // Format roll results for display
    static formatRollResult(rollResult) {
        const { notation, rolls, modifier, total } = rollResult;
        let display = `🎲 **${notation}**\n`;
        display += `Rolls: [${rolls.join(', ')}]`;
        
        if (modifier !== 0) {
            display += ` ${modifier > 0 ? '+' : ''}${modifier}`;
        }
        
        display += `\n**Total: ${total}**`;
        return display;
    }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DiceEngine;
}