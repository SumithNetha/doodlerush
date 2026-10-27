// Comprehensive curated dictionary categorized by themes and difficulty
const WORDS = [
  // Animals
  { word: "cat", category: "Animals", difficulty: "easy" },
  { word: "dog", category: "Animals", difficulty: "easy" },
  { word: "lion", category: "Animals", difficulty: "easy" },
  { word: "tiger", category: "Animals", difficulty: "easy" },
  { word: "penguin", category: "Animals", difficulty: "easy" },
  { word: "elephant", category: "Animals", difficulty: "medium" },
  { word: "giraffe", category: "Animals", difficulty: "medium" },
  { word: "dolphin", category: "Animals", difficulty: "medium" },
  { word: "kangaroo", category: "Animals", difficulty: "medium" },
  { word: "octopus", category: "Animals", difficulty: "medium" },
  { word: "chameleon", category: "Animals", difficulty: "hard" },
  { word: "platypus", category: "Animals", difficulty: "hard" },
  { word: "hedgehog", category: "Animals", difficulty: "hard" },
  { word: "flamingo", category: "Animals", difficulty: "medium" },
  { word: "koala", category: "Animals", difficulty: "easy" },
  { word: "butterfly", category: "Animals", difficulty: "easy" },
  { word: "shark", category: "Animals", difficulty: "easy" },
  { word: "owl", category: "Animals", difficulty: "easy" },
  { word: "zebra", category: "Animals", difficulty: "medium" },
  { word: "panda", category: "Animals", difficulty: "easy" },

  // Food & Drinks
  { word: "pizza", category: "Food & Drinks", difficulty: "easy" },
  { word: "burger", category: "Food & Drinks", difficulty: "easy" },
  { word: "ice cream", category: "Food & Drinks", difficulty: "easy" },
  { word: "sushi", category: "Food & Drinks", difficulty: "medium" },
  { word: "pancake", category: "Food & Drinks", difficulty: "easy" },
  { word: "taco", category: "Food & Drinks", difficulty: "easy" },
  { word: "cookie", category: "Food & Drinks", difficulty: "easy" },
  { word: "spaghetti", category: "Food & Drinks", difficulty: "medium" },
  { word: "popcorn", category: "Food & Drinks", difficulty: "easy" },
  { word: "croissant", category: "Food & Drinks", difficulty: "medium" },
  { word: "watermelon", category: "Food & Drinks", difficulty: "easy" },
  { word: "avocado", category: "Food & Drinks", difficulty: "medium" },
  { word: "pineapple", category: "Food & Drinks", difficulty: "medium" },
  { word: "cupcake", category: "Food & Drinks", difficulty: "easy" },
  { word: "burrito", category: "Food & Drinks", difficulty: "medium" },

  // Objects & Technology
  { word: "laptop", category: "Objects", difficulty: "easy" },
  { word: "smartphone", category: "Objects", difficulty: "easy" },
  { word: "rocket", category: "Objects", difficulty: "easy" },
  { word: "headphones", category: "Objects", difficulty: "medium" },
  { word: "telescope", category: "Objects", difficulty: "hard" },
  { word: "microscope", category: "Objects", difficulty: "hard" },
  { word: "drone", category: "Objects", difficulty: "medium" },
  { word: "guitar", category: "Objects", difficulty: "easy" },
  { word: "bicycle", category: "Objects", difficulty: "easy" },
  { word: "submarine", category: "Objects", difficulty: "medium" },
  { word: "umbrella", category: "Objects", difficulty: "easy" },
  { word: "clock", category: "Objects", difficulty: "easy" },
  { word: "camera", category: "Objects", difficulty: "easy" },
  { word: "backpack", category: "Objects", difficulty: "easy" },
  { word: "flashlight", category: "Objects", difficulty: "easy" },
  { word: "skateboard", category: "Objects", difficulty: "medium" },
  { word: "satellite", category: "Objects", difficulty: "hard" },
  { word: "robot", category: "Objects", difficulty: "easy" },

  // Nature & Places
  { word: "volcano", category: "Nature", difficulty: "medium" },
  { word: "waterfall", category: "Nature", difficulty: "medium" },
  { word: "lighthouse", category: "Nature", difficulty: "medium" },
  { word: "pyramid", category: "Nature", difficulty: "easy" },
  { word: "castle", category: "Nature", difficulty: "easy" },
  { word: "rainbow", category: "Nature", difficulty: "easy" },
  { word: "campfire", category: "Nature", difficulty: "easy" },
  { word: "island", category: "Nature", difficulty: "easy" },
  { word: "cave", category: "Nature", difficulty: "easy" },
  { word: "bridge", category: "Nature", difficulty: "easy" },
  { word: "tornado", category: "Nature", difficulty: "medium" },
  { word: "glacier", category: "Nature", difficulty: "hard" },
  { word: "windmill", category: "Nature", difficulty: "medium" },

  // Pop Culture & Fun
  { word: "superhero", category: "Fun", difficulty: "medium" },
  { word: "alien", category: "Fun", difficulty: "easy" },
  { word: "ghost", category: "Fun", difficulty: "easy" },
  { word: "wizard", category: "Fun", difficulty: "medium" },
  { word: "pirate", category: "Fun", difficulty: "easy" },
  { word: "dragon", category: "Fun", difficulty: "medium" },
  { word: "treasure", category: "Fun", difficulty: "easy" },
  { word: "astronaut", category: "Fun", difficulty: "medium" },
  { word: "ninja", category: "Fun", difficulty: "easy" },
  { word: "zombie", category: "Fun", difficulty: "easy" },
  { word: "vampire", category: "Fun", difficulty: "medium" },
  { word: "unicorn", category: "Fun", difficulty: "easy" }
];

function getRandomWordChoices(count = 3, usedWords = []) {
  const available = WORDS.filter(w => !usedWords.includes(w.word.toLowerCase()));
  const pool = available.length >= count ? available : WORDS;
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

module.exports = {
  WORDS,
  getRandomWordChoices
};
