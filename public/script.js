document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const panelHideBtn = document.getElementById('panelHideBtn');
    const sidePanel = document.getElementById('sidePanel');
    const mainContent = document.querySelector('.main-content');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const userInput = document.getElementById('userInput');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const themeToggle = document.getElementById('themeToggle');
    const userSelect = document.getElementById('userSelect');
    const newUserBtn = document.getElementById('newUserBtn');
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    const userForm = document.getElementById('userForm');
    const goalsForm = document.getElementById('goalsForm');
    const settingsForm = document.getElementById('settingsForm');

    // State Management
    let currentUser = null;
    let users = JSON.parse(localStorage.getItem('users')) || {};
    let settings = JSON.parse(localStorage.getItem('settings')) || {
        theme: 'light',
        apiKey: ''
    };

    // Initialize
    initializeApp();

    function initializeApp() {
        // Load settings
        loadSettings();
        
        // Load users
        loadUsers();
        
        // Update welcome message
        updateWelcomeMessage();
        
        // Set up event listeners
        setupEventListeners();
    }

    function loadSettings() {
        // Apply theme
        document.body.setAttribute('data-theme', settings.theme);
        themeToggle.checked = settings.theme === 'dark';
        
        // Load API key if exists
        if (settings.apiKey) {
            document.getElementById('apiKey').value = settings.apiKey;
        }
    }

    function loadUsers() {
        // Clear existing options
        userSelect.innerHTML = '<option value="">Select User</option>';
        
        // Add user options
        Object.keys(users).forEach(userId => {
            const option = document.createElement('option');
            option.value = userId;
            option.textContent = users[userId].name;
            userSelect.appendChild(option);
        });
    }

    function updateWelcomeMessage() {
        const hour = new Date().getHours();
        let greeting = 'Welcome';
        
        if (hour < 12) greeting = 'Good Morning';
        else if (hour < 18) greeting = 'Good Afternoon';
        else greeting = 'Good Evening';

        if (currentUser) {
            welcomeMessage.textContent = `${greeting}, ${currentUser.name}!`;
        } else {
            welcomeMessage.textContent = `${greeting} to StayFit`;
        }
    }

    function setupEventListeners() {
        // Panel Toggle
        hamburgerBtn.addEventListener('click', () => {
            sidePanel.classList.add('active');
            mainContent.classList.add('shifted');
        });

        panelHideBtn.addEventListener('click', () => {
            sidePanel.classList.remove('active');
            mainContent.classList.remove('shifted');
        });

        // Menu Items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');

                // Show corresponding content
                const section = item.dataset.section;
                document.querySelectorAll('.section-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${section}Content`).classList.add('active');
            });
        });

        // Theme Toggle
        themeToggle.addEventListener('change', () => {
            const newTheme = themeToggle.checked ? 'dark' : 'light';
            document.body.setAttribute('data-theme', newTheme);
            settings.theme = newTheme;
            localStorage.setItem('settings', JSON.stringify(settings));
        });

        // User Management
        userSelect.addEventListener('change', () => {
            const userId = userSelect.value;
            if (userId) {
                currentUser = users[userId];
                fillUserForm(currentUser);
                fillGoalsForm(currentUser);
            } else {
                currentUser = null;
                userForm.reset();
                goalsForm.reset();
            }
            updateWelcomeMessage();
        });

        newUserBtn.addEventListener('click', () => {
            userSelect.value = '';
            currentUser = null;
            userForm.reset();
            goalsForm.reset();
            updateWelcomeMessage();
        });

        deleteUserBtn.addEventListener('click', () => {
            if (currentUser) {
                if (confirm('Are you sure you want to delete this user?')) {
                    delete users[currentUser.id];
                    localStorage.setItem('users', JSON.stringify(users));
                    loadUsers();
                    currentUser = null;
                    userForm.reset();
                    goalsForm.reset();
                    updateWelcomeMessage();
                }
            }
        });

        // Form Submissions
        userForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userData = {
                id: currentUser?.id || Date.now().toString(),
                name: document.getElementById('userName').value,
                gender: document.getElementById('userGender').value,
                age: document.getElementById('userAge').value,
                height: document.getElementById('userHeight').value,
                weight: document.getElementById('userWeight').value
            };

            users[userData.id] = userData;
            localStorage.setItem('users', JSON.stringify(users));
            loadUsers();
            userSelect.value = userData.id;
            currentUser = userData;
            updateWelcomeMessage();
        });

        goalsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (currentUser) {
                currentUser.goals = {
                    dailyCalories: document.getElementById('dailyCalories').value,
                    targetWeight: document.getElementById('targetWeight').value
                };
                users[currentUser.id] = currentUser;
                localStorage.setItem('users', JSON.stringify(users));
            }
        });

        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            settings.apiKey = document.getElementById('apiKey').value;
            localStorage.setItem('settings', JSON.stringify(settings));
        });

        // Analyze Button
        analyzeBtn.addEventListener('click', async () => {
            const text = userInput.value.trim();
            if (!text) {
                alert('Please enter your food intake');
                return;
            }

            if (!currentUser) {
                alert('Please select or create a user profile first');
                return;
            }

            if (!currentUser.goals) {
                alert('Please set your daily calorie and weight goals first');
                return;
            }

            try {
                analyzeBtn.disabled = true;
                analyzeBtn.textContent = 'Analyzing...';

                const response = await fetch('/api/analyze-food', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text,
                        userGoals: currentUser.goals
                    })
                });

                const data = await response.json();
                if (response.ok) {
                    // Merge new foods with existing window.foodArray
                    let newFoods = Array.isArray(data.nutrition) ? data.nutrition : [];
                    if (window.foodArray && window.foodArray.length > 0) {
                        // Avoid duplicate food names (optional: can be smarter)
                        const existingNames = new Set(window.foodArray.map(f => f.food_name + '_' + f.user_quantity + '_' + f.user_unit));
                        newFoods = newFoods.filter(f => !existingNames.has(f.food_name + '_' + f.user_quantity + '_' + f.user_unit));
                        window.foodArray = window.foodArray.concat(newFoods);
                    } else {
                        window.foodArray = newFoods;
                    }
                    // Recalculate progress
                    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
                    window.foodArray.forEach(food => {
                        if (food.total_nutrition_for_user) {
                            totalCalories += Number(food.total_nutrition_for_user.calories) || 0;
                            totalProtein += Number(food.total_nutrition_for_user.protein) || 0;
                            totalCarbs += Number(food.total_nutrition_for_user.carbs) || 0;
                            totalFat += Number(food.total_nutrition_for_user.fat) || 0;
                        }
                    });
                    const newProgress = {
                        calories: (totalCalories / currentUser.goals.dailyCalories) * 100,
                        protein: (totalProtein / (currentUser.goals.dailyCalories * 0.25 / 4)) * 100,
                        carbs: (totalCarbs / (currentUser.goals.dailyCalories * 0.5 / 4)) * 100,
                        fat: (totalFat / (currentUser.goals.dailyCalories * 0.25 / 9)) * 100
                    };
                    updateNutritionDisplay({ nutrition: window.foodArray, progress: newProgress });
                    userInput.value = '';
                    // Automatically save all after analysis
                    saveAllFoodItems();
                } else {
                    throw new Error(data.error || 'Failed to analyze food intake');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error analyzing food intake. Please try again.');
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = 'Analyze';
            }
        });
    }

    function fillUserForm(user) {
        if (user) {
            document.getElementById('userName').value = user.name;
            document.getElementById('userGender').value = user.gender;
            document.getElementById('userAge').value = user.age;
            document.getElementById('userHeight').value = user.height;
            document.getElementById('userWeight').value = user.weight;
        }
    }

    function fillGoalsForm(user) {
        if (user && user.goals) {
            document.getElementById('dailyCalories').value = user.goals.dailyCalories;
            document.getElementById('targetWeight').value = user.goals.targetWeight;
        } else {
            goalsForm.reset();
        }
    }

    // Add new DOM elements for nutrition display
    const nutritionDisplay = document.createElement('div');
    nutritionDisplay.className = 'nutrition-display';
    nutritionDisplay.innerHTML = `
        <div class="progress-container">
            <div class="progress-item">
                <div class="progress-label">Calories</div>
                <div class="progress-bar">
                    <div class="progress-fill calories"></div>
                </div>
                <div class="progress-value">0/0 kcal</div>
            </div>
            <div class="progress-item">
                <div class="progress-label">Protein</div>
                <div class="progress-bar">
                    <div class="progress-fill protein"></div>
                </div>
                <div class="progress-value">0/0 g</div>
            </div>
            <div class="progress-item">
                <div class="progress-label">Carbs</div>
                <div class="progress-bar">
                    <div class="progress-fill carbs"></div>
                </div>
                <div class="progress-value">0/0 g</div>
            </div>
            <div class="progress-item">
                <div class="progress-label">Fat</div>
                <div class="progress-bar">
                    <div class="progress-fill fat"></div>
                </div>
                <div class="progress-value">0/0 g</div>
            </div>
        </div>
        <div class="food-breakdown"></div>
    `;
    document.querySelector('.input-area').appendChild(nutritionDisplay);

    // Store nutrition data globally
    window.foodArray = [];
    window.progress = {};

    function updateNutritionDisplay(data) {
        console.log('updateNutritionDisplay called with:', data);
        let { nutrition, progress } = data;

        // Determine if nutrition is an array (new format) or object (old format)
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

        if (Array.isArray(nutrition)) {
            // Normalize web-searched foods to match database structure
            nutrition = nutrition.map(food => {
                if (food.total_calories !== undefined) {
                    // Use user_quantity and user_unit if present, else fallback to quantity/unit
                    const user_quantity = Number(food.user_quantity || food.quantity || 1);
                    const user_unit = food.user_unit || food.unit || 'serving';
                    return {
                        food_name: food.food_name || food.original_text || 'Unknown Food',
                        user_quantity,
                        user_unit,
                        db_serving_size: 1,
                        db_serving_unit: user_unit,
                        db_nutrition_per_serving: {
                            calories: Number(food.total_calories) / user_quantity,
                            protein: Number(food.total_protein) / user_quantity,
                            carbs: Number(food.total_carbs) / user_quantity,
                            fat: Number(food.total_fat) / user_quantity
                        },
                        total_nutrition_for_user: {
                            calories: Number(food.total_calories),
                            protein: Number(food.total_protein),
                            carbs: Number(food.total_carbs),
                            fat: Number(food.total_fat)
                        },
                        note: food.note || '',
                        source: food.source || ''
                    };
                }
                return food;
            });
            window.foodArray = nutrition;
            window.foodArray.forEach(food => {
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
        } else if (nutrition && typeof nutrition === 'object') {
            window.foodArray = nutrition.food_breakdown || data.matched_foods || [];
            totalCalories = nutrition.total_calories || 0;
            totalProtein = nutrition.total_protein || 0;
            totalCarbs = nutrition.total_carbs || 0;
            totalFat = nutrition.total_fat || 0;
        }

        // Update progress bars
        progress = progress || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        updateProgressBar('calories', progress.calories, totalCalories, currentUser.goals.dailyCalories, 'kcal');
        updateProgressBar('protein', progress.protein, totalProtein, currentUser.goals.dailyCalories * 0.25 / 4, 'g');
        updateProgressBar('carbs', progress.carbs, totalCarbs, currentUser.goals.dailyCalories * 0.5 / 4, 'g');
        updateProgressBar('fat', progress.fat, totalFat, currentUser.goals.dailyCalories * 0.25 / 9, 'g');

        // Update food breakdown
        const breakdownDiv = document.querySelector('.food-breakdown');
        breakdownDiv.innerHTML = '<h3>Food Breakdown</h3>';

        // Add "Save All" button at the top
        let saveAllBtn = document.getElementById('saveAllBtn');
        if (!saveAllBtn) {
            saveAllBtn = document.createElement('button');
            saveAllBtn.id = 'saveAllBtn';
            saveAllBtn.className = 'add-food-btn';
            saveAllBtn.textContent = 'Save All';
            saveAllBtn.onclick = saveAllFoodItems;
        }
        breakdownDiv.appendChild(saveAllBtn);
        // Move the button to the top
        if (breakdownDiv.firstChild !== saveAllBtn) {
            breakdownDiv.insertBefore(saveAllBtn, breakdownDiv.firstChild.nextSibling);
        }

        window.foodArray.forEach((food, index) => {
            const foodDiv = document.createElement('div');
            foodDiv.className = 'food-item';
            foodDiv.dataset.index = index;

            // Food header row
            const headerRow = document.createElement('div');
            headerRow.className = 'food-header';
            headerRow.innerHTML = `
                <input type="text" class="food-name-input" value="${food.food_name || food.matched_food?.food_name || food.original_text || 'Unknown Food'}" placeholder="Food name">
                <input type="number" class="food-quantity-input" value="${food.user_quantity || food.quantity || 1}" placeholder="Qty">
                <input type="text" class="food-unit-input" value="${food.user_unit || food.unit || 'serving'}" placeholder="Unit">
            `;
            foodDiv.appendChild(headerRow);

            // Nutrition information
            const nutritionDiv = document.createElement('div');
            nutritionDiv.className = 'food-nutrition';
            if (food.db_nutrition_per_serving) {
                nutritionDiv.innerHTML = `
                    <div class="nutrition-item">
                        <span class="nutrition-label">Per ${food.db_serving_unit || 'serving'}:</span>
                        <span class="nutrition-value">Cal: <input type="number" class="nutrition-input" data-type="calories" data-per-serving="true" value="${Math.round(food.db_nutrition_per_serving.calories) || 0}"></span>
                        <span class="nutrition-value">P: <input type="number" class="nutrition-input" data-type="protein" data-per-serving="true" value="${Math.round(food.db_nutrition_per_serving.protein) || 0}">g</span>
                        <span class="nutrition-value">C: <input type="number" class="nutrition-input" data-type="carbs" data-per-serving="true" value="${Math.round(food.db_nutrition_per_serving.carbs) || 0}">g</span>
                        <span class="nutrition-value">F: <input type="number" class="nutrition-input" data-type="fat" data-per-serving="true" value="${Math.round(food.db_nutrition_per_serving.fat) || 0}">g</span>
                    </div>
                `;
            }
            if (food.total_nutrition_for_user) {
                nutritionDiv.innerHTML += `
                    <div class="nutrition-item">
                        <span class="nutrition-label">Total:</span>
                        <span class="nutrition-value">Cal: <input type="number" class="nutrition-input" data-type="calories" data-per-serving="false" value="${Math.round(food.total_nutrition_for_user.calories) || 0}"></span>
                        <span class="nutrition-value">P: <input type="number" class="nutrition-input" data-type="protein" data-per-serving="false" value="${Math.round(food.total_nutrition_for_user.protein) || 0}">g</span>
                        <span class="nutrition-value">C: <input type="number" class="nutrition-input" data-type="carbs" data-per-serving="false" value="${Math.round(food.total_nutrition_for_user.carbs) || 0}">g</span>
                        <span class="nutrition-value">F: <input type="number" class="nutrition-input" data-type="fat" data-per-serving="false" value="${Math.round(food.total_nutrition_for_user.fat) || 0}">g</span>
                    </div>
                `;
            }
            foodDiv.appendChild(nutritionDiv);

            // Note and source information
            if (food.note || food.source) {
                const noteDiv = document.createElement('div');
                noteDiv.className = 'food-note';
                noteDiv.textContent = food.note || `Source: ${food.source || 'Local database'}`;
                foodDiv.appendChild(noteDiv);
            }

            // Only Delete button per card
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'food-actions';
            actionsDiv.innerHTML = `
                <button class="food-action-btn delete" onclick="deleteFoodItem(${index})">Delete</button>
            `;
            foodDiv.appendChild(actionsDiv);

            breakdownDiv.appendChild(foodDiv);
        });

        // Add "Add Food" button at the bottom
        const addFoodBtn = document.createElement('button');
        addFoodBtn.className = 'add-food-btn';
        addFoodBtn.textContent = 'Add New Food Item';
        addFoodBtn.onclick = addNewFoodItem;
        breakdownDiv.appendChild(addFoodBtn);
    }

    // Save all food items at once
    function saveAllFoodItems() {
        // For each food card, update the corresponding food object
        document.querySelectorAll('.food-item').forEach(foodItem => {
            const index = foodItem.dataset.index;
            const nameInput = foodItem.querySelector('.food-name-input');
            const quantityInput = foodItem.querySelector('.food-quantity-input');
            const unitInput = foodItem.querySelector('.food-unit-input');
            const nutritionInputs = foodItem.querySelectorAll('.nutrition-input');
            const food = window.foodArray[index];
            food.food_name = nameInput.value;
            food.user_quantity = Number(quantityInput.value);
            food.user_unit = unitInput.value;
            nutritionInputs.forEach(input => {
                const type = input.dataset.type;
                const isPerServing = input.dataset.perServing === 'true';
                const value = Number(input.value) || 0;
                if (isPerServing) {
                    if (!food.db_nutrition_per_serving) food.db_nutrition_per_serving = {};
                    food.db_nutrition_per_serving[type] = value;
                } else {
                    if (!food.total_nutrition_for_user) food.total_nutrition_for_user = {};
                    food.total_nutrition_for_user[type] = value;
                    if (food.total_calories !== undefined) {
                        if (type === 'calories') food.total_calories = value;
                        if (type === 'protein') food.total_protein = value;
                        if (type === 'carbs') food.total_carbs = value;
                        if (type === 'fat') food.total_fat = value;
                    }
                }
            });
            // Recalculate totals if per-serving values were updated
            if (food.db_nutrition_per_serving) {
                const multiplier = food.user_quantity;
                food.total_nutrition_for_user = {
                    calories: food.db_nutrition_per_serving.calories * multiplier,
                    protein: food.db_nutrition_per_serving.protein * multiplier,
                    carbs: food.db_nutrition_per_serving.carbs * multiplier,
                    fat: food.db_nutrition_per_serving.fat * multiplier
                };
            }
        });
        // Recalculate progress
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        window.foodArray.forEach(food => {
            if (food.total_nutrition_for_user) {
                totalCalories += Number(food.total_nutrition_for_user.calories) || 0;
                totalProtein += Number(food.total_nutrition_for_user.protein) || 0;
                totalCarbs += Number(food.total_nutrition_for_user.carbs) || 0;
                totalFat += Number(food.total_nutrition_for_user.fat) || 0;
            }
        });
        const newProgress = {
            calories: (totalCalories / currentUser.goals.dailyCalories) * 100,
            protein: (totalProtein / (currentUser.goals.dailyCalories * 0.25 / 4)) * 100,
            carbs: (totalCarbs / (currentUser.goals.dailyCalories * 0.5 / 4)) * 100,
            fat: (totalFat / (currentUser.goals.dailyCalories * 0.25 / 9)) * 100
        };
        updateNutritionDisplay({ nutrition: window.foodArray, progress: newProgress });
    }

    function deleteFoodItem(index) {
        if (confirm('Are you sure you want to delete this food item?')) {
            window.foodArray.splice(index, 1);
            // Recalculate totals after deletion
            let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
            window.foodArray.forEach(food => {
                if (food.total_nutrition_for_user) {
                    totalCalories += Number(food.total_nutrition_for_user.calories) || 0;
                    totalProtein += Number(food.total_nutrition_for_user.protein) || 0;
                    totalCarbs += Number(food.total_nutrition_for_user.carbs) || 0;
                    totalFat += Number(food.total_nutrition_for_user.fat) || 0;
                }
            });
            // Calculate new progress
            const newProgress = {
                calories: (totalCalories / currentUser.goals.dailyCalories) * 100,
                protein: (totalProtein / (currentUser.goals.dailyCalories * 0.25 / 4)) * 100,
                carbs: (totalCarbs / (currentUser.goals.dailyCalories * 0.5 / 4)) * 100,
                fat: (totalFat / (currentUser.goals.dailyCalories * 0.25 / 9)) * 100
            };
            // Update the display with new totals
            updateNutritionDisplay({ nutrition: window.foodArray, progress: newProgress });
        }
    }
    window.deleteFoodItem = deleteFoodItem;
    function addNewFoodItem() {
        const newFood = {
            food_name: 'New Food',
            user_quantity: 1,
            user_unit: 'serving',
            db_nutrition_per_serving: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0
            },
            total_nutrition_for_user: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0
            },
            note: 'Manually added food item'
        };

        window.foodArray.push(newFood);
        updateNutritionDisplay({ nutrition: window.foodArray, progress: window.progress });
    }

    function updateProgressBar(type, percentage, current, target, unit) {
        const fill = document.querySelector(`.progress-fill.${type}`);
        const value = document.querySelector(`.progress-item:nth-child(${getProgressItemIndex(type)}) .progress-value`);
        
        // Ensure percentage doesn't exceed 100%
        const cappedPercentage = Math.min(percentage, 100);
        
        fill.style.width = `${cappedPercentage}%`;
        value.textContent = `${Math.round(current)}/${Math.round(target)} ${unit}`;
        
        // Update color based on percentage
        if (cappedPercentage > 90) {
            fill.style.backgroundColor = '#e74c3c'; // Red for over 90%
        } else if (cappedPercentage > 70) {
            fill.style.backgroundColor = '#f1c40f'; // Yellow for 70-90%
        } else {
            fill.style.backgroundColor = '#2ecc71'; // Green for under 70%
        }
    }

    function getProgressItemIndex(type) {
        const types = ['calories', 'protein', 'carbs', 'fat'];
        return types.indexOf(type) + 1;
    }

    // Add event listener for quantity changes
    function setupQuantityChangeListener() {
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('food-quantity-input')) {
                const foodItem = e.target.closest('.food-item');
                const index = foodItem.dataset.index;
                saveFoodItem(index);
            }
        });
    }

    // Call this after the DOM is loaded
    setupQuantityChangeListener();

    // Expose these functions globally for onclick handlers
    window.saveFoodItem = saveFoodItem;
    window.deleteFoodItem = deleteFoodItem;
}); 