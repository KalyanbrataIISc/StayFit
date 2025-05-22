require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini AI
const genAI = new GoogleGenAI({
    apiKey: process.env.API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Load food database
const foodDatabase = require('./data/foodDatabase.json');

// Extract just the food names for initial matching
const foodNames = foodDatabase.map(food => food.food_name);

// Helper function to parse JSON response
function parseJSONResponse(text) {
    try {
        // Remove any markdown code block indicators
        text = text.replace(/```json\n?|\n?```/g, '');
        // Remove any leading/trailing whitespace
        text = text.trim();
        return JSON.parse(text);
    } catch (error) {
        console.error('Error parsing JSON:', error);
        console.error('Raw text:', text);
        throw new Error('Invalid JSON response from AI');
    }
}

// Food Analysis Route
app.post('/api/analyze-food', async (req, res) => {
    try {
        const { text, userGoals } = req.body;
        
        // Initialize Gemini models with config
        const config = {
            responseMimeType: 'text/plain'
        };

        // First agent: Match foods from database using only food names
        const foodMatchPrompt = `
        You are a food matching expert. Your task is to:
        1. Parse the following food intake text and identify individual food items and their quantities
        2. Match each food item with the closest matching item from the provided list of food names
        3. IMPORTANT: Only match if the food item is an EXACT match or a very close match (95% or more confidence)
        4. For any food item that:
           - Is not in the list
           - Has a different main ingredient (e.g., chicken vs mutton)
           - Has significant nutritional differences
           - Cannot be matched with 95% or more confidence
           Set "needs_web_search": true and "matched_food_name": null
        5. Return a JSON array of objects with the following structure:
        {
            "original_text": "the original food mention",
            "quantity": "the quantity mentioned",
            "unit": "the unit mentioned",
            "matched_food_name": "name from the list" or null,
            "needs_web_search": true or false,
            "confidence": number between 0 and 1
        }

        IMPORTANT: 
        - Return ONLY the JSON array, no other text or markdown formatting
        - Be very strict about matches - if in doubt, set needs_web_search to true
        - For example, if someone says "chicken biryani" and the list has "mutton biryani", set needs_web_search to true
        - If someone says "rice" and the list has "brown rice", set needs_web_search to true
        - When needs_web_search is true, matched_food_name must be null
        - When needs_web_search is false, matched_food_name must be a string from the list

        List of Food Names: ${JSON.stringify(foodNames)}
        
        User's food intake text: "${text}"
        `;

        const foodMatchResult = await genAI.models.generateContentStream({
            model: 'gemini-2.5-flash-preview-05-20',
            config,
            contents: [{
                role: 'user',
                parts: [{ text: foodMatchPrompt }]
            }]
        });

        let foodMatchResponse = '';
        for await (const chunk of foodMatchResult) {
            foodMatchResponse += chunk.text;
        }
        const matchedFoods = parseJSONResponse(foodMatchResponse);

        // Get full data for matched foods
        const matchedFoodData = matchedFoods
            .filter(food => !food.needs_web_search && food.confidence >= 0.95 && food.matched_food_name !== null)
            .map(food => {
                const fullData = foodDatabase.find(dbFood => dbFood.food_name === food.matched_food_name);
                return {
                    ...food,
                    matched_food: fullData
                };
            });

        // Prepare a more informative structure for Gemini
        const matchedFoodsForGemini = matchedFoodData.map(food => ({
            original_text: food.original_text,
            quantity: food.quantity,
            unit: food.unit,
            matched_food_name: food.matched_food_name,
            nutrition_per_serving: food.matched_food ? {
                calories: food.matched_food.unit_serving_energy_kcal || 0,
                protein: food.matched_food.unit_serving_protein_g || 0,
                carbs: food.matched_food.unit_serving_carb_g || 0,
                fat: food.matched_food.unit_serving_fat_g || 0,
                serving_size: 1,
                serving_unit: food.matched_food.servings_unit || null
            } : null
        }));

        // Second agent: Calculate nutrition for matched foods
        const nutritionPrompt = `
        You are a nutrition calculation expert.
        For each matched food item, you are provided with:
        - The user's mentioned quantity and unit (e.g., "3 pieces", "2 cups")
        - The nutrition data per serving from the database, including serving size and unit (e.g., "1 piece", "1 cup"), and the nutrition values for that serving.

        Your tasks:
        1. For each food, compare the user's mentioned quantity and unit with the database serving size and unit.
        2. If the units match (e.g., both are 'piece' or both are 'cup'), multiply the nutrition values by the user's quantity.
        3. If the units do not match, use common sense or standard conversions to estimate the total nutrition for the user's quantity.
        4. For each food, output:
           - The per-unit nutrition values from the database (as provided)
           - The total nutrition values for the user's quantity (calculated)
           - A note string: "Values taken directly from the local food database."
        5. Use ONLY the nutrition values provided from the database for your calculations. Do NOT use any other sources or estimates.
        6. For each food, you MUST output all of: calories, protein, carbs, and fat. If any value is missing, set it to 0.

        Return a JSON array, one object per food, with the following structure:
        {
          "food_name": string,
          "db_serving_size": string,
          "db_serving_unit": string,
          "db_nutrition_per_serving": {
            "calories": number,
            "protein": number,
            "carbs": number,
            "fat": number
          },
          "user_quantity": number,
          "user_unit": string,
          "total_nutrition_for_user": {
            "calories": number,
            "protein": number,
            "carbs": number,
            "fat": number
          },
          "note": string
        }

        Matched Foods with Full Data: ${JSON.stringify(matchedFoodsForGemini)}
        `;

        const nutritionResult = await genAI.models.generateContentStream({
            model: 'gemini-2.5-flash-preview-05-20',
            config,
            contents: [{
                role: 'user',
                parts: [{ text: nutritionPrompt }]
            }]
        });

        let nutritionResponse = '';
        for await (const chunk of nutritionResult) {
            nutritionResponse += chunk.text;
        }
        const nutritionData = parseJSONResponse(nutritionResponse);

        // If any foods need web search or have low confidence, use the third agent
        const needsWebSearch = matchedFoods.filter(food => 
            food.needs_web_search || 
            food.confidence < 0.95 || 
            food.matched_food_name === null
        );
        if (needsWebSearch.length > 0) {
            const webSearchPrompt = `
            You are a nutrition research expert. Your task is to:
            1. Search for nutritional information for the following foods:
            ${JSON.stringify(needsWebSearch)}
            2. For each food, calculate the total nutritional values based on:
               - The user's mentioned quantity and unit
               - If the user's input is unclear or missing, use a reasonable default (e.g., 1 plate, 1 bowl, 1 serving, or standard portion size)
               - Standard serving sizes from credible sources
               - Common unit conversions (e.g., 1 plate ≈ 250g, 1 cup ≈ 240ml)
            3. For each food, you MUST provide all of: quantity, unit, total_calories, total_protein, total_carbs, total_fat. Never leave quantity or unit as null. If not specified, use your own knowledge to fill in a reasonable value.
            4. For each food, include a note string describing the source (URL if available) and the method (web data or AI estimate).

            IMPORTANT: 
            - Return ONLY the JSON array, no other text or markdown formatting
            - Calculate TOTAL values based on the user's quantity
            - For example, if user says "3 plates", multiply the per-serving values by 3
            - Use standard serving sizes: 1 plate = 250g, 1 cup = 240ml, 1 katori = 150g

            Format the response as a JSON array of objects with:
            {
                "food_name": "original food name",
                "quantity": "user's mentioned quantity, or a reasonable default (never null)",
                "unit": "user's mentioned unit, or a reasonable default (never null)",
                "total_calories": number,
                "total_protein": number,
                "total_carbs": number,
                "total_fat": number,
                "source": "URL of the source (if available)",
                "note": "one sentence describing the source and method used for the data"
            }
            `;

            const webSearchResult = await genAI.models.generateContentStream({
                model: 'gemini-2.5-flash-preview-05-20',
                config,
                contents: [{
                    role: 'user',
                    parts: [{ text: webSearchPrompt }]
                }]
            });

            let webSearchResponse = '';
            for await (const chunk of webSearchResult) {
                webSearchResponse += chunk.text;
            }
            const webSearchData = parseJSONResponse(webSearchResponse);

            // Merge web search results with database results
            nutritionData.web_search_results = webSearchData;
        }

        // Debug logging
        console.log('nutritionData:', nutritionData);
        console.log('userGoals:', userGoals);

        // Helper to safely parse numbers
        const safeNumber = v => {
            if (typeof v === 'number' && !isNaN(v)) return v;
            if (typeof v === 'string') {
                // Remove any non-numeric characters (e.g., 'g', 'kcal')
                const num = parseFloat(v.replace(/[^0-9.\-eE]/g, ''));
                return isNaN(num) ? 0 : num;
            }
            return 0;
        };

        // Flatten nutrition array: combine DB and web foods if needed
        let finalNutritionArray = [];
        if (Array.isArray(nutritionData)) {
            finalNutritionArray = nutritionData;
            if (nutritionData.web_search_results && Array.isArray(nutritionData.web_search_results)) {
                finalNutritionArray = [...nutritionData, ...nutritionData.web_search_results];
            }
        } else if (nutritionData && Array.isArray(nutritionData.web_search_results)) {
            finalNutritionArray = nutritionData.web_search_results;
        }

        // Calculate totals from finalNutritionArray for progress bars
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        finalNutritionArray.forEach(food => {
            if (food.total_nutrition_for_user) {
                totalCalories += Number(food.total_nutrition_for_user.calories) || 0;
                totalProtein += Number(food.total_nutrition_for_user.protein) || 0;
                totalCarbs += Number(food.total_nutrition_for_user.carbs) || 0;
                totalFat += Number(food.total_nutrition_for_user.fat) || 0;
            } else if (
                food.total_calories !== undefined &&
                food.total_protein !== undefined &&
                food.total_carbs !== undefined &&
                food.total_fat !== undefined
            ) {
                totalCalories += Number(food.total_calories) || 0;
                totalProtein += Number(food.total_protein) || 0;
                totalCarbs += Number(food.total_carbs) || 0;
                totalFat += Number(food.total_fat) || 0;
            }
        });

        // Calculate progress towards goals using the summed totals
        const progress = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };

        if (userGoals && userGoals.dailyCalories > 0) {
            if (totalCalories >= 0) {
                progress.calories = (totalCalories / userGoals.dailyCalories) * 100;
            }
            const proteinGoal = (userGoals.dailyCalories * 0.25) / 4;
            if (proteinGoal > 0 && totalProtein >= 0) {
                progress.protein = (totalProtein / proteinGoal) * 100;
            }
            const carbsGoal = (userGoals.dailyCalories * 0.5) / 4;
            if (carbsGoal > 0 && totalCarbs >= 0) {
                progress.carbs = (totalCarbs / carbsGoal) * 100;
            }
            const fatGoal = (userGoals.dailyCalories * 0.25) / 9;
            if (fatGoal > 0 && totalFat >= 0) {
                progress.fat = (totalFat / fatGoal) * 100;
            }
        }

        Object.keys(progress).forEach(key => {
            if (isNaN(progress[key]) || !isFinite(progress[key])) {
                progress[key] = 0;
            }
        });

        res.json({
            nutrition: finalNutritionArray,
            progress: progress,
            matched_foods: matchedFoodData
        });

    } catch (error) {
        console.error('Error analyzing food:', error);
        res.status(500).json({ error: 'Error analyzing food intake' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 