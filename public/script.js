document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const panelHideBtn = document.getElementById('panelHideBtn');
    const sidePanel = document.getElementById('sidePanel');
    const mainContent = document.querySelector('.main-content');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const userInput = document.getElementById('userInput');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const themeSelect = document.getElementById('themeSelect');
    const loveThemeOption = document.getElementById('loveThemeOption');
    const userSelect = document.getElementById('userSelect');
    const newUserBtn = document.getElementById('newUserBtn');
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    const userForm = document.getElementById('userForm');
    const goalsForm = document.getElementById('goalsForm');
    const settingsForm = document.getElementById('settingsForm');

    // Hide love theme option by default
    console.log('DOM loaded, hiding love theme option by default');
    if (loveThemeOption) {
        loveThemeOption.style.display = 'none';
        console.log('Love theme option hidden');
    } else {
        console.error('Love theme option element not found!');
    }

    // Calendar Elements
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const currentMonthEl = document.getElementById('currentMonth');
    const calendarGrid = document.getElementById('calendarGrid');
    const selectedDateEl = document.getElementById('selectedDate');
    const dayFoodItems = document.getElementById('dayFoodItems');

    // State Management
    let currentUser = null;
    let users = JSON.parse(localStorage.getItem('users')) || {};
    let settings = JSON.parse(localStorage.getItem('settings')) || {
        theme: 'light',
        apiKey: ''
    };
    let selectedDate = new Date();
    let currentMonth = new Date();
    let foodArray = []; // Initialize foodArray

    // Special users who can see the love theme
    const specialUsers = ['swaru', 'swarnim', 'swarnim sharma'];

    function isSpecialUser(userName) {
        if (!userName) return false;
        const result = specialUsers.includes(userName.toLowerCase().trim());
        console.log(`Checking if "${userName}" is special user:`, result);
        console.log('Special users list:', specialUsers);
        console.log('Lowercase name:', userName.toLowerCase().trim());
        return result;
    }

    // Test function for debugging (accessible from console)
    window.testSpecialUser = function(name) {
        console.log('Testing name:', name);
        return isSpecialUser(name);
    };

    // Make functions available for debugging
    window.updateThemeOptions = updateThemeOptions;
    window.updateSubtitle = updateSubtitle;

    function updateSubtitle() {
        console.log('updateSubtitle called');
        console.log('currentUser:', currentUser?.name);
        console.log('current theme:', settings.theme);
        console.log('isSpecialUser:', currentUser ? isSpecialUser(currentUser.name) : false);
        
        const subtitleEl = document.querySelector('.app-subtitle');
        if (currentUser && isSpecialUser(currentUser.name) && settings.theme === 'love') {
            console.log('Setting special subtitle');
            subtitleEl.textContent = 'by Keechy, for Swaru';
        } else {
            console.log('Setting normal subtitle');
            subtitleEl.textContent = 'by Kalyanbrata Chandra';
        }
    }

    function updateThemeOptions() {
        console.log('updateThemeOptions called');
        console.log('currentUser:', currentUser);
        console.log('currentUser name:', currentUser?.name);
        console.log('isSpecialUser result:', currentUser ? isSpecialUser(currentUser.name) : false);
        console.log('loveThemeOption element:', loveThemeOption);
        
        if (!loveThemeOption) {
            console.error('Love theme option element not found!');
            return;
        }
        
        if (currentUser && isSpecialUser(currentUser.name)) {
            console.log('Showing love theme option');
            loveThemeOption.style.display = 'block';
            loveThemeOption.style.visibility = 'visible';
        } else {
            console.log('Hiding love theme option');
            loveThemeOption.style.display = 'none';
            loveThemeOption.style.visibility = 'hidden';
            
            // If current theme is love and user is not special, switch to light
            if (settings.theme === 'love') {
                console.log('Switching from love theme to light');
                settings.theme = 'light';
                document.body.setAttribute('data-theme', 'light');
                localStorage.setItem('settings', JSON.stringify(settings));
            }
        }
        
        themeSelect.value = settings.theme;
        console.log('Theme select value set to:', settings.theme);
        console.log('Love theme option display:', loveThemeOption.style.display);
    }

    // Initialize
    initializeApp();

    function initializeApp() {
        // Load settings
        loadSettings();
        
        // Load users
        loadUsers();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initialize calendar
        initializeCalendar();

        // Create nutrition display elements
        createNutritionDisplay();
        
        // Initial theme options update (hide love theme by default)
        updateThemeOptions();
        updateSubtitle();
        
        // Select last opened user if exists
        const lastUserId = localStorage.getItem('lastUserId');
        if (lastUserId && users[lastUserId]) {
            userSelect.value = lastUserId;
            currentUser = users[lastUserId];
            console.log('Loading last user:', currentUser.name);
            fillUserForm(currentUser);
            fillGoalsForm(currentUser);
            loadTodayData();
            
            // Update theme options again after user is loaded
            updateThemeOptions();
            updateSubtitle();
        } else {
            // No user selected - ensure love theme is not active
            console.log('No user selected on init');
            if (settings.theme === 'love') {
                console.log('No user but love theme active - switching to light');
                settings.theme = 'light';
                document.body.setAttribute('data-theme', 'light');
                localStorage.setItem('settings', JSON.stringify(settings));
                if (themeSelect) {
                    themeSelect.value = 'light';
                }
            }
        }
        
        // Update welcome message
        updateWelcomeMessage();
    }

    function loadSettings() {
        // Apply theme
        document.body.setAttribute('data-theme', settings.theme);
        // Don't set theme select value here - will be done in updateThemeOptions
        
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

        // Add delete food data button to user form if it doesn't exist
        if (!document.getElementById('deleteFoodDataBtn')) {
            const deleteFoodDataBtn = document.createElement('button');
            deleteFoodDataBtn.type = 'button';
            deleteFoodDataBtn.id = 'deleteFoodDataBtn';
            deleteFoodDataBtn.className = 'action-btn delete';
            deleteFoodDataBtn.textContent = 'Delete Food Data';
            deleteFoodDataBtn.addEventListener('click', () => {
                if (currentUser && confirm('Are you sure you want to delete all food data for this user? This action cannot be undone.')) {
                    currentUser.dailyData = {};
                    users[currentUser.id] = currentUser;
                    localStorage.setItem('users', JSON.stringify(users));
                    foodArray = [];
                    updateNutritionDisplay({ 
                        nutrition: [], 
                        progress: { calories: 0, protein: 0, carbs: 0, fat: 0 } 
                    });
                    renderCalendar();
                }
            });
            userForm.querySelector('.form-buttons').appendChild(deleteFoodDataBtn);
        }
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

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            // Check if click is outside the panel and not on the hamburger button
            if (!sidePanel.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                if (sidePanel.classList.contains('active')) {
                    sidePanel.classList.remove('active');
                    mainContent.classList.remove('shifted');
                }
            }
        });

        // Menu Items with toggle functionality
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                const contentElement = document.getElementById(`${section}Content`);
                const isCurrentlyActive = item.classList.contains('active');
                
                // If clicking the same item that's active, toggle it
                if (isCurrentlyActive) {
                    item.classList.remove('active');
                    contentElement.classList.remove('active');
                } else {
                    // Remove active state from all items and contents
                    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                    document.querySelectorAll('.section-content').forEach(content => {
                        content.classList.remove('active');
                    });
                    
                    // Add active state to clicked item
                    item.classList.add('active');
                    contentElement.classList.add('active');
                }
            });
        });

        // Theme Toggle
        themeSelect.addEventListener('change', () => {
            const newTheme = themeSelect.value;
            console.log('Theme changed to:', newTheme);
            
            // Validate that love theme can only be selected by special users
            if (newTheme === 'love' && (!currentUser || !isSpecialUser(currentUser.name))) {
                console.log('Love theme not allowed for this user, reverting to light');
                alert('This theme is not available for your user.');
                themeSelect.value = 'light';
                settings.theme = 'light';
            } else {
                settings.theme = newTheme;
            }
            
            document.body.setAttribute('data-theme', settings.theme);
            localStorage.setItem('settings', JSON.stringify(settings));
            updateSubtitle();
        });

        // User Management
        userSelect.addEventListener('change', () => {
            const userId = userSelect.value;
            console.log('User selected:', userId);
            
            if (userId) {
                currentUser = users[userId];
                console.log('Current user set to:', currentUser.name);
                fillUserForm(currentUser);
                fillGoalsForm(currentUser);
                loadTodayData();
                // Save last selected user
                localStorage.setItem('lastUserId', userId);
            } else {
                console.log('No user selected');
                currentUser = null;
                userForm.reset();
                goalsForm.reset();
                foodArray = [];
                updateNutritionDisplay({ 
                    nutrition: [], 
                    progress: { calories: 0, protein: 0, carbs: 0, fat: 0 } 
                });
                // Clear last selected user
                localStorage.removeItem('lastUserId');
            }
            updateWelcomeMessage();
            updateThemeOptions();
            updateSubtitle();
            
            // Additional safety check: if love theme is active but user is not special, switch to light
            if (settings.theme === 'love' && (!currentUser || !isSpecialUser(currentUser.name))) {
                console.log('Safety check: Love theme active but user not special, switching to light');
                settings.theme = 'light';
                document.body.setAttribute('data-theme', 'light');
                localStorage.setItem('settings', JSON.stringify(settings));
                if (themeSelect) {
                    themeSelect.value = 'light';
                }
            }
        });

        newUserBtn.addEventListener('click', () => {
            userSelect.value = '';
            currentUser = null;
            userForm.reset();
            goalsForm.reset();
            updateWelcomeMessage();
            updateThemeOptions();
            updateSubtitle();
        });

        deleteUserBtn.addEventListener('click', () => {
            if (currentUser) {
                if (confirm('Are you sure you want to delete this user and all their data? This action cannot be undone.')) {
                    delete users[currentUser.id];
                    localStorage.setItem('users', JSON.stringify(users));
                    loadUsers();
                    currentUser = null;
                    userForm.reset();
                    goalsForm.reset();
                    updateWelcomeMessage();
                    updateThemeOptions();
                    updateSubtitle();
                    renderCalendar();
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
            updateThemeOptions();
            updateSubtitle();
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

            let retryCount = 0;
            const maxRetries = 3;

            async function tryAnalyze() {
                try {
                    analyzeBtn.disabled = true;
                    analyzeBtn.textContent = retryCount > 0 ? `Analyzing... (Attempt ${retryCount + 1}/${maxRetries})` : 'Analyzing...';

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
                        // Merge new foods with existing foodArray
                        let newFoods = Array.isArray(data.nutrition) ? data.nutrition : [];
                        if (foodArray && foodArray.length > 0) {
                            // Avoid duplicate food names (optional: can be smarter)
                            const existingNames = new Set(foodArray.map(f => f.food_name + '_' + f.user_quantity + '_' + f.user_unit));
                            newFoods = newFoods.filter(f => !existingNames.has(f.food_name + '_' + f.user_quantity + '_' + f.user_unit));
                            foodArray = foodArray.concat(newFoods);
                        } else {
                            foodArray = newFoods;
                        }
                        // Recalculate progress
                        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
                        foodArray.forEach(food => {
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
                        updateNutritionDisplay({ nutrition: foodArray, progress: newProgress });
                        userInput.value = '';
                        // Automatically save all after analysis
                        saveAllFoodItems();
                        return true; // Success
                    } else {
                        throw new Error(data.error || 'Failed to analyze food intake');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    if (retryCount < maxRetries - 1) {
                        retryCount++;
                        // Wait for 1 second before retrying
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        return tryAnalyze(); // Retry
                    }
                    throw error; // If all retries failed, throw the error
                }
            }

            try {
                await tryAnalyze();
            } catch (error) {
                alert('Error analyzing food intake. Please try again later.');
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

    function loadTodayData() {
        if (!currentUser) return; // Add safety check

        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        if (currentUser.dailyData && currentUser.dailyData[dateStr]) {
            foodArray = currentUser.dailyData[dateStr].foods || [];
            updateNutritionDisplay({ 
                nutrition: foodArray, 
                progress: currentUser.dailyData[dateStr].progress || {} 
            });
        } else {
            foodArray = [];
            updateNutritionDisplay({ 
                nutrition: [], 
                progress: { calories: 0, protein: 0, carbs: 0, fat: 0 } 
            });
        }
    }

    // Add new DOM elements for nutrition display
    function createNutritionDisplay() {
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
    }

    // Store nutrition data globally
    window.foodArray = foodArray;
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
            foodArray = nutrition;
            foodArray.forEach(food => {
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
            foodArray = nutrition.food_breakdown || data.matched_foods || [];
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

        foodArray.forEach((food, index) => {
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
        if (!currentUser) return;

        // For each food card, update the corresponding food object
        document.querySelectorAll('.food-item').forEach(foodItem => {
            const index = foodItem.dataset.index;
            const nameInput = foodItem.querySelector('.food-name-input');
            const quantityInput = foodItem.querySelector('.food-quantity-input');
            const unitInput = foodItem.querySelector('.food-unit-input');
            const nutritionInputs = foodItem.querySelectorAll('.nutrition-input');
            const food = foodArray[index];
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

        // Calculate totals
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
        foodArray.forEach(food => {
            if (food.total_nutrition_for_user) {
                totalCalories += Number(food.total_nutrition_for_user.calories) || 0;
                totalProtein += Number(food.total_nutrition_for_user.protein) || 0;
                totalCarbs += Number(food.total_nutrition_for_user.carbs) || 0;
                totalFat += Number(food.total_nutrition_for_user.fat) || 0;
            }
        });

        // Calculate progress
        const progress = {
            calories: (totalCalories / currentUser.goals.dailyCalories) * 100,
            protein: (totalProtein / (currentUser.goals.dailyCalories * 0.25 / 4)) * 100,
            carbs: (totalCarbs / (currentUser.goals.dailyCalories * 0.5 / 4)) * 100,
            fat: (totalFat / (currentUser.goals.dailyCalories * 0.25 / 9)) * 100
        };

        // Get current date string in local timezone
        const now = selectedDate instanceof Date ? selectedDate : new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Initialize dailyData if it doesn't exist
        if (!currentUser.dailyData) {
            currentUser.dailyData = {};
        }

        // Save or remove current food array and progress
        if (foodArray.length > 0) {
            currentUser.dailyData[dateStr] = {
                foods: foodArray,
                progress: progress
            };
        } else {
            // Remove the date entry if no foods
            delete currentUser.dailyData[dateStr];
        }

        // Update users object and save to localStorage
        users[currentUser.id] = currentUser;
        localStorage.setItem('users', JSON.stringify(users));

        // Update the display immediately
        updateNutritionDisplay({ 
            nutrition: foodArray, 
            progress: progress 
        });

        // Update calendar display
        renderCalendar();
    }

    function deleteFoodItem(index) {
        if (confirm('Are you sure you want to delete this food item?')) {
            foodArray.splice(index, 1);
            // Recalculate totals after deletion
            let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
            foodArray.forEach(food => {
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
            // Get current date string in local timezone
            const now = selectedDate instanceof Date ? selectedDate : new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            // Remove the date entry if no foods
            if (foodArray.length === 0 && currentUser.dailyData) {
                delete currentUser.dailyData[dateStr];
            }
            // Update the display with new totals
            updateNutritionDisplay({ nutrition: foodArray, progress: newProgress });
            renderCalendar();
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

        foodArray.push(newFood);
        updateNutritionDisplay({ nutrition: foodArray, progress: window.progress });
    }

    function updateProgressBar(type, percentage, current, target, unit) {
        const fill = document.querySelector(`.progress-fill.${type}`);
        const value = document.querySelector(`.progress-item:nth-child(${getProgressItemIndex(type)}) .progress-value`);
        
        if (!fill || !value) return; // Add safety check
        
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

    // Calendar Functions
    function initializeCalendar() {
        // Add weekday headers
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekdays.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'weekday';
            dayEl.textContent = day;
            calendarGrid.appendChild(dayEl);
        });

        // Set up calendar navigation
        prevMonthBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            renderCalendar();
        });

        nextMonthBtn.addEventListener('click', () => {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            renderCalendar();
        });

        // Initial render
        renderCalendar();
    }

    function renderCalendar() {
        // Clear existing days
        calendarGrid.innerHTML = '';

        // Add weekday headers
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekdays.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'weekday';
            dayEl.textContent = day;
            calendarGrid.appendChild(dayEl);
        });

        // Update month display
        currentMonthEl.textContent = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Get first day of month and total days
        const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const totalDays = lastDay.getDate();
        const startingDay = firstDay.getDay();

        // Add days from previous month
        const prevMonthLastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();
        for (let i = startingDay - 1; i >= 0; i--) {
            const dayEl = document.createElement('div');
            dayEl.className = 'day other-month';
            dayEl.textContent = prevMonthLastDay - i;
            calendarGrid.appendChild(dayEl);
        }

        // Add days of current month
        for (let i = 1; i <= totalDays; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'day';
            dayEl.textContent = i;

            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
            const dateStr = date.toISOString().split('T')[0];

            // Check if it's today
            if (date.toDateString() === new Date().toDateString()) {
                dayEl.classList.add('today');
            }

            // Check if it's selected
            if (date.toDateString() === selectedDate.toDateString()) {
                dayEl.classList.add('selected');
            }

            // Check if it has data
            if (currentUser && currentUser.dailyData) {
                if (currentUser.dailyData[dateStr] && currentUser.dailyData[dateStr].foods && currentUser.dailyData[dateStr].foods.length > 0) {
                    dayEl.classList.add('has-data');
                }
            }

            dayEl.addEventListener('click', () => {
                selectedDate = date;
                renderCalendar();
                loadDayData(date);
            });

            calendarGrid.appendChild(dayEl);
        }

        // Add days from next month
        const remainingDays = 42 - (startingDay + totalDays); // 42 = 6 rows * 7 days
        for (let i = 1; i <= remainingDays; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'day other-month';
            dayEl.textContent = i;
            calendarGrid.appendChild(dayEl);
        }
    }

    function loadDayData(date) {
        // Format date string in local timezone
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        selectedDateEl.textContent = date.toLocaleDateString('default', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Clear existing items
        dayFoodItems.innerHTML = '';

        if (currentUser && currentUser.dailyData && currentUser.dailyData[dateStr]) {
            const dayData = currentUser.dailyData[dateStr];
            foodArray = dayData.foods || [];
            updateNutritionDisplay({ 
                nutrition: foodArray, 
                progress: dayData.progress || {} 
            });
        } else {
            foodArray = [];
            updateNutritionDisplay({ 
                nutrition: [], 
                progress: { calories: 0, protein: 0, carbs: 0, fat: 0 } 
            });
        }
    }

    // Add clear data button to settings form
    const clearDataBtn = document.createElement('button');
    clearDataBtn.type = 'button';
    clearDataBtn.className = 'action-btn delete';
    clearDataBtn.textContent = 'Clear All Data';
    clearDataBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all data? This will delete all food entries for all users. This action cannot be undone.')) {
            Object.keys(users).forEach(userId => {
                if (users[userId].dailyData) {
                    delete users[userId].dailyData;
                }
            });
            localStorage.setItem('users', JSON.stringify(users));
            if (currentUser) {
                currentUser.dailyData = {};
                foodArray = [];
                updateNutritionDisplay({ 
                    nutrition: [], 
                    progress: { calories: 0, protein: 0, carbs: 0, fat: 0 } 
                });
                renderCalendar();
            }
        }
    });
    settingsForm.appendChild(clearDataBtn);

    // Add clear user data button to user form
    const clearUserDataBtn = document.createElement('button');
    clearUserDataBtn.type = 'button';
    clearUserDataBtn.className = 'action-btn delete';
    clearUserDataBtn.textContent = 'Clear User Data';
    clearUserDataBtn.addEventListener('click', () => {
        if (currentUser && confirm('Are you sure you want to clear all food data for this user? This action cannot be undone.')) {
            currentUser.dailyData = {};
            users[currentUser.id] = currentUser;
            localStorage.setItem('users', JSON.stringify(users));
            renderCalendar();
        }
    });
    userForm.querySelector('.form-buttons').appendChild(clearUserDataBtn);
}); 