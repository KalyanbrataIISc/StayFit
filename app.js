require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

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

// OpenFoodFacts API search function - returns top 5 matches for agent selection
async function searchFood(query, userQuantity = 1, userUnit = 'serving') {
    const url = 'https://world.openfoodfacts.org/cgi/search.pl';

    try {
        console.log(`🔍 Searching OpenFoodFacts for: "${query}" (${userQuantity} ${userUnit})`);
        
        const response = await axios.get(url, {
            params: {
                search_terms: query,
                search_simple: 1,
                action: 'process',
                json: 1
            },
            timeout: 100000 // 100 second timeout
        });

        const products = response.data.products;

        if (!products || products.length === 0) {
            console.log(`❌ No products found for "${query}".`);
            return null;
        }

        console.log(`📦 Found ${products.length} products for "${query}"`);

        // Get top 5 products with the most complete nutrition data
        const validProducts = products
            .filter(p => p.nutriments && p.product_name)
            .slice(0, 5)
            .map((product, index) => {
                const name = product.product_name || query;
                const nutriments = product.nutriments || {};

                const nutritionData = {
                    calories: parseFloat(nutriments['energy-kcal_100g']) || 0,
                    protein: parseFloat(nutriments['proteins_100g']) || 0,
                    carbs: parseFloat(nutriments['carbohydrates_100g']) || 0,
                    fat: parseFloat(nutriments['fat_100g']) || 0
                };

                console.log(`  ${index + 1}. "${name}"`);
                console.log(`     Per 100g: ${nutritionData.calories} kcal, ${nutritionData.protein}g protein, ${nutritionData.carbs}g carbs, ${nutritionData.fat}g fat`);
                console.log(`     URL: ${product.url || 'N/A'}`);

                return {
                    product_name: name,
                    nutrition_per_100g: nutritionData,
                    url: product.url || '',
                    completeness_score: Object.values(nutritionData).filter(v => v > 0).length
                };
            })
            .sort((a, b) => b.completeness_score - a.completeness_score); // Sort by completeness

        if (validProducts.length === 0) {
            console.log(`❌ No valid products with nutrition data found for "${query}"`);
            return null;
        }

        console.log(`✅ Returning ${validProducts.length} options for AI selection`);

        // Return data structure for AI agent to process
        return {
            original_text: query,
            quantity: userQuantity,
            unit: userUnit,
            search_results: validProducts,
            data_source: 'openfoodfacts'
        };

    } catch (error) {
        console.error(`💥 Error fetching food data for "${query}":`, error.message);
        return null;
    }
}

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

// Food Analysis Route with Progress Updates
app.get('/api/analyze-food-progress', async (req, res) => {
    // Set up Server-Sent Events
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendProgress = (stage, percentage, message) => {
        const data = JSON.stringify({ stage, percentage, message });
        res.write(`data: ${data}\n\n`);
    };

    // Enhanced JSON parser with better error handling
    const parseJSONResponseWithRetry = (text, attempt = 1) => {
        try {
            // Clean the text more aggressively
            let cleanText = text.trim();
            
            // Remove any trailing undefined/null/extra text after JSON
            const jsonMatch = cleanText.match(/^(\[[\s\S]*\])/);
            if (jsonMatch) {
                cleanText = jsonMatch[1];
            }
            
            // Remove any markdown code block indicators
            cleanText = cleanText.replace(/```json\n?|\n?```/g, '');
            cleanText = cleanText.replace(/```\n?|\n?```/g, '');
            
            // Remove any trailing commas in JSON
            cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');
            
            return JSON.parse(cleanText);
        } catch (error) {
            console.error(`JSON parsing attempt ${attempt} failed:`, error.message);
            console.error('Raw text (first 500 chars):', text.substring(0, 500));
            console.error('Raw text (last 200 chars):', text.substring(text.length - 200));
            throw new Error(`Invalid JSON response from AI (attempt ${attempt}): ${error.message}`);
        }
    };

    // Retry wrapper for AI operations
    const retryAIOperation = async (operation, operationName, maxRetries = 5) => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    sendProgress('retrying', Math.max(10, 80), `Retrying ${operationName}... (Attempt ${attempt}/${maxRetries})`);
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                const result = await operation();
                return result;
                
            } catch (error) {
                lastError = error;
                console.error(`${operationName} attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    console.error(`All ${maxRetries} attempts for ${operationName} failed`);
                    throw error;
                }
            }
        }
        
        throw lastError;
    };

    try {
        const { text, userGoals } = JSON.parse(req.query.data || '{}');
        
        sendProgress('parsing', 10, 'Parsing food items...');
        
        // Initialize Gemini models with config
        const config = {
            responseMimeType: 'text/plain'
        };

        // First agent: Match foods from database using only food names
        const foodMatchPrompt = `
        You are a food parsing expert. Your task is to:
        1. Parse the following food intake text and identify individual food items
        2. For each food item, extract:
           - Clean food name (remove quantities, adjectives like "little bit of", "some", etc.)
           - Quantity (convert words like "little bit" to approximate numbers)
           - Unit (standardize units like "katori", "glass", "scoop", etc.)
        3. Match the CLEAN food name with the closest matching item from the provided list
        4. IMPORTANT: Only match if the clean food name is an EXACT match or very close match (95% or more confidence)
        5. For any food item that cannot be matched with 95%+ confidence, set "needs_web_search": true

        Examples of clean extraction:
        - "little bit of rice" → clean_food_name: "rice", quantity: 0.5, unit: "serving"
        - "2 katori sukto" → clean_food_name: "sukto", quantity: 2, unit: "katori"  
        - "3 glass grape juice" → clean_food_name: "grape juice", quantity: 3, unit: "glass"
        - "some chicken" → clean_food_name: "chicken", quantity: 1, unit: "serving"

        6. Return a JSON array of objects with this structure:
        {
            "original_text": "the original food mention",
            "clean_food_name": "cleaned food name for searching",
            "quantity": number,
            "unit": "standardized unit",
            "matched_food_name": "name from the list" or null,
            "needs_web_search": true or false,
            "confidence": number between 0 and 1
        }

        IMPORTANT: 
        - Return ONLY the JSON array, no other text
        - clean_food_name should be searchable (no quantities, minimal adjectives)
        - When needs_web_search is true, matched_food_name must be null
        - When needs_web_search is false, matched_food_name must be from the provided list

        List of Food Names: ${JSON.stringify(foodNames)}
        
        User's food intake text: "${text}"
        `;

        sendProgress('matching', 25, 'Matching with local database...');

        // Retry the food matching operation
        const matchedFoods = await retryAIOperation(async () => {
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
            return parseJSONResponseWithRetry(foodMatchResponse);
        }, 'food matching');

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
            clean_food_name: food.clean_food_name,
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

        // If any foods need web search or have low confidence, use OpenFoodFacts API
        const needsWebSearch = matchedFoods.filter(food => 
            food.needs_web_search || 
            food.confidence < 0.95 || 
            food.matched_food_name === null
        );
        
        let openFoodFactsData = [];
        if (needsWebSearch.length > 0) {
            sendProgress('searching', 50, `Searching external databases for ${needsWebSearch.length} items...`);
            
            // Search each food using OpenFoodFacts API
            const searchPromises = needsWebSearch.map(async (food, index) => {
                // Send mini-progress updates for each search
                const searchProgress = 50 + (index / needsWebSearch.length) * 25;
                sendProgress('searching', searchProgress, `Searching for ${food.clean_food_name}...`);
                
                // Use clean_food_name for searching instead of original_text
                const foodName = food.clean_food_name || food.original_text || '';
                const quantity = food.quantity || 1;
                const unit = food.unit || 'serving';
                
                const result = await searchFood(foodName, quantity, unit);
                
                if (result) {
                    return {
                        ...result,
                        original_text: food.original_text,
                        clean_food_name: food.clean_food_name
                    };
                } else {
                    // Fallback: create a minimal entry if OpenFoodFacts search fails
                    console.log(`❌ OpenFoodFacts search failed for: ${foodName}`);
                    return {
                        original_text: food.original_text,
                        clean_food_name: food.clean_food_name,
                        quantity: quantity,
                        unit: unit,
                        search_results: [{
                            product_name: food.clean_food_name || foodName,
                            nutrition_per_100g: {
                                calories: 0,
                                protein: 0,
                                carbs: 0,
                                fat: 0
                            },
                            url: '',
                            completeness_score: 0
                        }],
                        data_source: 'openfoodfacts'
                    };
                }
            });
            
            try {
                openFoodFactsData = await Promise.all(searchPromises);
                openFoodFactsData = openFoodFactsData.filter(result => result !== null);
                console.log(`Successfully retrieved data for ${openFoodFactsData.length} foods from OpenFoodFacts`);
            } catch (error) {
                console.error('Error during OpenFoodFacts searches:', error);
                openFoodFactsData = [];
            }
        }

        sendProgress('calculating', 80, 'Calculating nutrition values with AI...');

        // Combine all food data for unified processing by second agent
        const allFoodsForProcessing = [
            ...matchedFoodsForGemini,
            ...openFoodFactsData
        ];

        // Second agent: Calculate nutrition for ALL foods (from both local database and OpenFoodFacts)
        console.log(`🧠 Processing ${allFoodsForProcessing.length} foods through final nutrition calculation agent...`);
        
        const nutritionPrompt = `
        You are a nutrition calculation expert. You will receive food data from two sources:
        1. Local database foods with nutrition_per_serving data
        2. OpenFoodFacts API foods with multiple search_results to choose from

        Your tasks:
        1. For OpenFoodFacts foods: SELECT THE BEST MATCH from the search_results array based on:
           - Relevance to the original query
           - Completeness of nutrition data (higher completeness_score is better)
           - Most appropriate for the food type mentioned

        2. For foods with NO DATA FOUND (all search_results have 0 calories):
           - Use your nutritional knowledge to provide REASONABLE ESTIMATES
           - Base estimates on typical nutritional values for that food type
           - Consider regional/cultural food variations (e.g., Indian dishes)
           - Mark these clearly in the note as "AI estimated values based on typical nutritional content"

        3. Calculate nutritional values using these conversions:
           - 1 plate = 250g, 1 bowl = 200g, 1 katori = 150g
           - 1 cup = 240ml/g, 1 tbsp = 15g, 1 tsp = 5g
           - 1 slice = 30g, 1 piece = 50g (adjust based on food type)
           - 1 serving = 100g (default), but be contextual
           - 1 scoop (ice cream) = 65g, 1 glass = 240ml

        4. CRITICAL: The db_nutrition_per_serving field must represent nutrition for 1 USER UNIT:
           - If user says "2 plates", db_nutrition_per_serving = nutrition for 1 plate (250g worth)
           - If user says "3 pieces", db_nutrition_per_serving = nutrition for 1 piece
           - If user says "1 cup", db_nutrition_per_serving = nutrition for 1 cup (240g worth)
           - The frontend multiplies db_nutrition_per_serving × user_quantity to get total

        5. For each food, return this EXACT structure:
        {
          "food_name": "clear, user-friendly food name",
          "db_serving_size": number (size of 1 user unit in grams),
          "db_serving_unit": "user's unit (plate/piece/cup/etc)",
          "db_nutrition_per_serving": {
            "calories": number (for 1 user unit),
            "protein": number (for 1 user unit),
            "carbs": number (for 1 user unit),
            "fat": number (for 1 user unit)
          },
          "user_quantity": number,
          "user_unit": "unit",
          "total_nutrition_for_user": {
            "calories": number (total for all quantities),
            "protein": number (total for all quantities),
            "carbs": number (total for all quantities),
            "fat": number (total for all quantities)
          },
          "note": "user-friendly description"
        }

        6. EXAMPLE ESTIMATES for common Indian foods when no data found:
           - Rice (cooked): ~130 kcal, 2.7g protein, 28g carbs, 0.3g fat per 100g
           - Sukto (Bengali mixed vegetables): ~80 kcal, 3g protein, 12g carbs, 3g fat per 100g
           - Bhetki fish curry: ~150 kcal, 20g protein, 5g carbs, 6g fat per 100g
           - Grape juice: ~60 kcal, 0.2g protein, 15g carbs, 0g fat per 100ml
           - Vanilla ice cream: ~200 kcal, 3.5g protein, 24g carbs, 10g fat per 100g

        7. For note field, write:
           - "Nutritional data from our food database" (for local DB)
           - "Data sourced from OpenFoodFacts food database" (for API data)
           - "AI estimated values based on typical nutritional content" (for AI estimates)

        IMPORTANT: 
        - NEVER return 0 calories unless the food truly has no calories
        - Use your knowledge to provide reasonable estimates when data is missing
        - Round calories to whole numbers, other nutrients to 1 decimal place
        - Be contextual about portion sizes (biryani plate vs fruit piece)
        - Ensure db_nutrition_per_serving × user_quantity = total_nutrition_for_user

        Foods to process: ${JSON.stringify(allFoodsForProcessing, null, 2)}
        `;

        // Retry the nutrition calculation operation
        const finalNutritionData = await retryAIOperation(async () => {
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
            return parseJSONResponseWithRetry(nutritionResponse);
        }, 'nutrition calculation');

        sendProgress('finalizing', 95, 'Finalizing results...');

        // Calculate progress towards goals using the summed totals
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        finalNutritionData.forEach(food => {
            if (food.total_nutrition_for_user) {
                totalCalories += Number(food.total_nutrition_for_user.calories) || 0;
                totalProtein += Number(food.total_nutrition_for_user.protein) || 0;
                totalCarbs += Number(food.total_nutrition_for_user.carbs) || 0;
                totalFat += Number(food.total_nutrition_for_user.fat) || 0;
            }
        });

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

        sendProgress('complete', 100, 'Analysis complete!');

        // Send final result
        const result = {
            nutrition: finalNutritionData,
            progress: progress,
            matched_foods: matchedFoodData
        };

        res.write(`data: ${JSON.stringify({ stage: 'result', data: result })}\n\n`);
        res.end();

    } catch (error) {
        console.error('Error analyzing food:', error);
        sendProgress('error', 0, `Error analyzing food intake: ${error.message}`);
        res.end();
    }
});

// Food Analysis Route
app.post('/api/analyze-food', async (req, res) => {
    // Helper function to retry operations with better error handling
    const retryOperation = async (operation, operationName, maxRetries = 5) => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`🔄 Retrying ${operationName}... (Attempt ${attempt}/${maxRetries})`);
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                const result = await operation();
                if (attempt > 1) {
                    console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
                }
                return result;
                
            } catch (error) {
                lastError = error;
                console.error(`❌ ${operationName} attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    console.error(`💥 All ${maxRetries} attempts for ${operationName} failed`);
                    throw error;
                }
            }
        }
        
        throw lastError;
    };

    // Enhanced JSON parser with better error handling
    const parseJSONResponseWithRetry = (text, attempt = 1) => {
        try {
            // Clean the text more aggressively
            let cleanText = text.trim();
            
            // Remove any trailing undefined/null/extra text after JSON
            const jsonMatch = cleanText.match(/^(\[[\s\S]*\])/);
            if (jsonMatch) {
                cleanText = jsonMatch[1];
            }
            
            // Remove any markdown code block indicators
            cleanText = cleanText.replace(/```json\n?|\n?```/g, '');
            cleanText = cleanText.replace(/```\n?|\n?```/g, '');
            
            // Remove any trailing commas in JSON
            cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');
            
            return JSON.parse(cleanText);
        } catch (error) {
            console.error(`JSON parsing attempt ${attempt} failed:`, error.message);
            console.error('Raw text (first 500 chars):', text.substring(0, 500));
            console.error('Raw text (last 200 chars):', text.substring(text.length - 200));
            throw new Error(`Invalid JSON response from AI (attempt ${attempt}): ${error.message}`);
        }
    };

    try {
        const { text, userGoals } = req.body;
        
        // Initialize Gemini models with config
        const config = {
            responseMimeType: 'text/plain'
        };

        // First agent: Match foods from database using only food names
        const foodMatchPrompt = `
        You are a food parsing expert. Your task is to:
        1. Parse the following food intake text and identify individual food items
        2. For each food item, extract:
           - Clean food name (remove quantities, adjectives like "little bit of", "some", etc.)
           - Quantity (convert words like "little bit" to approximate numbers)
           - Unit (standardize units like "katori", "glass", "scoop", etc.)
        3. Match the CLEAN food name with the closest matching item from the provided list
        4. IMPORTANT: Only match if the clean food name is an EXACT match or very close match (95% or more confidence)
        5. For any food item that cannot be matched with 95%+ confidence, set "needs_web_search": true

        Examples of clean extraction:
        - "little bit of rice" → clean_food_name: "rice", quantity: 0.5, unit: "serving"
        - "2 katori sukto" → clean_food_name: "sukto", quantity: 2, unit: "katori"  
        - "3 glass grape juice" → clean_food_name: "grape juice", quantity: 3, unit: "glass"
        - "some chicken" → clean_food_name: "chicken", quantity: 1, unit: "serving"

        6. Return a JSON array of objects with this structure:
        {
            "original_text": "the original food mention",
            "clean_food_name": "cleaned food name for searching",
            "quantity": number,
            "unit": "standardized unit",
            "matched_food_name": "name from the list" or null,
            "needs_web_search": true or false,
            "confidence": number between 0 and 1
        }

        IMPORTANT: 
        - Return ONLY the JSON array, no other text
        - clean_food_name should be searchable (no quantities, minimal adjectives)
        - When needs_web_search is true, matched_food_name must be null
        - When needs_web_search is false, matched_food_name must be from the provided list

        List of Food Names: ${JSON.stringify(foodNames)}
        
        User's food intake text: "${text}"
        `;

        // Retry the food matching operation
        const matchedFoods = await retryOperation(async () => {
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
            return parseJSONResponseWithRetry(foodMatchResponse);
        }, 'food matching');

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
            clean_food_name: food.clean_food_name,
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

        // If any foods need web search or have low confidence, use OpenFoodFacts API
        const needsWebSearch = matchedFoods.filter(food => 
            food.needs_web_search || 
            food.confidence < 0.95 || 
            food.matched_food_name === null
        );
        
        let openFoodFactsData = [];
        if (needsWebSearch.length > 0) {
            console.log(`Searching OpenFoodFacts for ${needsWebSearch.length} foods...`);
            
            // Search each food using OpenFoodFacts API
            const searchPromises = needsWebSearch.map(async (food) => {
                // Use clean_food_name for searching instead of original_text
                const foodName = food.clean_food_name || food.original_text || '';
                const quantity = food.quantity || 1;
                const unit = food.unit || 'serving';
                
                const result = await searchFood(foodName, quantity, unit);
                
                if (result) {
                    return {
                        ...result,
                        original_text: food.original_text,
                        clean_food_name: food.clean_food_name
                    };
                } else {
                    // Fallback: create a minimal entry if OpenFoodFacts search fails
                    console.log(`❌ OpenFoodFacts search failed for: ${foodName}`);
                    return {
                        original_text: food.original_text,
                        clean_food_name: food.clean_food_name,
                        quantity: quantity,
                        unit: unit,
                        search_results: [{
                            product_name: food.clean_food_name || foodName,
                            nutrition_per_100g: {
                                calories: 0,
                                protein: 0,
                                carbs: 0,
                                fat: 0
                            },
                            url: '',
                            completeness_score: 0
                        }],
                        data_source: 'openfoodfacts'
                    };
                }
            });
            
            try {
                openFoodFactsData = await Promise.all(searchPromises);
                // Filter out null results
                openFoodFactsData = openFoodFactsData.filter(result => result !== null);
                console.log(`Successfully retrieved data for ${openFoodFactsData.length} foods from OpenFoodFacts`);
            } catch (error) {
                console.error('Error during OpenFoodFacts searches:', error);
                openFoodFactsData = [];
            }
        }

        // Combine all food data for unified processing by second agent
        const allFoodsForProcessing = [
            ...matchedFoodsForGemini,
            ...openFoodFactsData
        ];

        // Second agent: Calculate nutrition for ALL foods (from both local database and OpenFoodFacts)
        console.log(`🧠 Processing ${allFoodsForProcessing.length} foods through final nutrition calculation agent...`);
        
        const nutritionPrompt = `
        You are a nutrition calculation expert. You will receive food data from two sources:
        1. Local database foods with nutrition_per_serving data
        2. OpenFoodFacts API foods with multiple search_results to choose from

        Your tasks:
        1. For OpenFoodFacts foods: SELECT THE BEST MATCH from the search_results array based on:
           - Relevance to the original query
           - Completeness of nutrition data (higher completeness_score is better)
           - Most appropriate for the food type mentioned

        2. For foods with NO DATA FOUND (all search_results have 0 calories):
           - Use your nutritional knowledge to provide REASONABLE ESTIMATES
           - Base estimates on typical nutritional values for that food type
           - Consider regional/cultural food variations (e.g., Indian dishes)
           - Mark these clearly in the note as "AI estimated values based on typical nutritional content"

        3. Calculate nutritional values using these conversions:
           - 1 plate = 250g, 1 bowl = 200g, 1 katori = 150g
           - 1 cup = 240ml/g, 1 tbsp = 15g, 1 tsp = 5g
           - 1 slice = 30g, 1 piece = 50g (adjust based on food type)
           - 1 serving = 100g (default), but be contextual
           - 1 scoop (ice cream) = 65g, 1 glass = 240ml

        4. CRITICAL: The db_nutrition_per_serving field must represent nutrition for 1 USER UNIT:
           - If user says "2 plates", db_nutrition_per_serving = nutrition for 1 plate (250g worth)
           - If user says "3 pieces", db_nutrition_per_serving = nutrition for 1 piece
           - If user says "1 cup", db_nutrition_per_serving = nutrition for 1 cup (240g worth)
           - The frontend multiplies db_nutrition_per_serving × user_quantity to get total

        5. For each food, return this EXACT structure:
        {
          "food_name": "clear, user-friendly food name",
          "db_serving_size": number (size of 1 user unit in grams),
          "db_serving_unit": "user's unit (plate/piece/cup/etc)",
          "db_nutrition_per_serving": {
            "calories": number (for 1 user unit),
            "protein": number (for 1 user unit),
            "carbs": number (for 1 user unit),
            "fat": number (for 1 user unit)
          },
          "user_quantity": number,
          "user_unit": "unit",
          "total_nutrition_for_user": {
            "calories": number (total for all quantities),
            "protein": number (total for all quantities),
            "carbs": number (total for all quantities),
            "fat": number (total for all quantities)
          },
          "note": "user-friendly description"
        }

        6. EXAMPLE ESTIMATES for common Indian foods when no data found:
           - Rice (cooked): ~130 kcal, 2.7g protein, 28g carbs, 0.3g fat per 100g
           - Sukto (Bengali mixed vegetables): ~80 kcal, 3g protein, 12g carbs, 3g fat per 100g
           - Bhetki fish curry: ~150 kcal, 20g protein, 5g carbs, 6g fat per 100g
           - Grape juice: ~60 kcal, 0.2g protein, 15g carbs, 0g fat per 100ml
           - Vanilla ice cream: ~200 kcal, 3.5g protein, 24g carbs, 10g fat per 100g

        7. For note field, write:
           - "Nutritional data from our food database" (for local DB)
           - "Data sourced from OpenFoodFacts food database" (for API data)
           - "AI estimated values based on typical nutritional content" (for AI estimates)

        IMPORTANT: 
        - NEVER return 0 calories unless the food truly has no calories
        - Use your knowledge to provide reasonable estimates when data is missing
        - Round calories to whole numbers, other nutrients to 1 decimal place
        - Be contextual about portion sizes (biryani plate vs fruit piece)
        - Ensure db_nutrition_per_serving × user_quantity = total_nutrition_for_user

        Foods to process: ${JSON.stringify(allFoodsForProcessing, null, 2)}
        `;

        // Retry the nutrition calculation operation
        const finalNutritionData = await retryOperation(async () => {
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
            return parseJSONResponseWithRetry(nutritionResponse);
        }, 'nutrition calculation');

        // Debug logging with better formatting
        console.log('🎯 Final Nutrition Data:');
        finalNutritionData.forEach((food, index) => {
            console.log(`  ${index + 1}. ${food.food_name}`);
            console.log(`     User portion: ${food.user_quantity} ${food.user_unit}`);
            console.log(`     Per ${food.db_serving_unit}: ${food.db_nutrition_per_serving.calories} kcal, ${food.db_nutrition_per_serving.protein}g protein`);
            console.log(`     Total nutrition: ${food.total_nutrition_for_user.calories} kcal, ${food.total_nutrition_for_user.protein}g protein`);
            console.log(`     Calculation check: ${food.db_nutrition_per_serving.calories} × ${food.user_quantity} = ${food.db_nutrition_per_serving.calories * food.user_quantity} (should match total)`);
            console.log(`     Note: ${food.note}`);
        });

        // Debug logging
        console.log('finalNutritionData:', finalNutritionData);
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

        // Calculate totals from finalNutritionData for progress bars
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        finalNutritionData.forEach(food => {
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
            nutrition: finalNutritionData,
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

// Test endpoint for special user functionality
app.get('/test-special-user/:name', (req, res) => {
    const { name } = req.params;
    const specialUsers = ['swaru', 'swarnim', 'swarnim sharma'];
    const isSpecial = specialUsers.includes(name.toLowerCase().trim());
    
    res.json({ 
        name: name,
        isSpecial: isSpecial,
        specialUsers: specialUsers,
        lowercaseName: name.toLowerCase().trim()
    });
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