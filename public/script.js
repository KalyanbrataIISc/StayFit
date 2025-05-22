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
                    updateNutritionDisplay(data);
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

    function updateNutritionDisplay(data) {
        console.log('updateNutritionDisplay called with:', data);
        let { nutrition, progress } = data;

        // Determine if nutrition is an array (new format) or object (old format)
        let foodArray = [];
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;

        if (Array.isArray(nutrition)) {
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
            // fallback for old format
            foodArray = nutrition.food_breakdown || data.matched_foods || [];
            totalCalories = nutrition.total_calories || 0;
            totalProtein = nutrition.total_protein || 0;
            totalCarbs = nutrition.total_carbs || 0;
            totalFat = nutrition.total_fat || 0;
        }
        console.log('foodArray:', foodArray);
        console.log('Totals:', { totalCalories, totalProtein, totalCarbs, totalFat });
        console.log('Progress:', progress);

        // Fallback for progress if undefined
        progress = progress || { calories: 0, protein: 0, carbs: 0, fat: 0 };

        // Update progress bars
        updateProgressBar('calories', progress.calories, totalCalories, currentUser.goals.dailyCalories, 'kcal');
        updateProgressBar('protein', progress.protein, totalProtein, currentUser.goals.dailyCalories * 0.25 / 4, 'g');
        updateProgressBar('carbs', progress.carbs, totalCarbs, currentUser.goals.dailyCalories * 0.5 / 4, 'g');
        updateProgressBar('fat', progress.fat, totalFat, currentUser.goals.dailyCalories * 0.25 / 9, 'g');

        // Update food breakdown
        const breakdownDiv = document.querySelector('.food-breakdown');
        breakdownDiv.innerHTML = '<h3>Food Breakdown</h3>';

        foodArray.forEach(food => {
            const foodDiv = document.createElement('div');
            foodDiv.className = 'food-item';
            foodDiv.style.display = 'flex';
            foodDiv.style.flexDirection = 'column';
            foodDiv.style.gap = '2px';
            let html = `<div class="food-row"><span class="food-label"><b>${food.food_name || food.matched_food?.food_name || food.original_text || 'Unknown Food'}</b></span>`;
            if (food.user_quantity && food.user_unit) {
                html += ` <span class="food-quantity">${food.user_quantity} ${food.user_unit}</span>`;
            } else if (food.quantity && food.unit) {
                html += ` <span class="food-quantity">${food.quantity} ${food.unit}</span>`;
            }
            html += '</div>';
            if (food.db_nutrition_per_serving) {
                html += `<div class="food-row"><span class="food-label">Per ${food.db_serving_unit || ''}:</span> ` +
                    `<span>Cal: ${Math.round(food.db_nutrition_per_serving.calories) || 0}, </span>` +
                    `<span>P: ${Math.round(food.db_nutrition_per_serving.protein) || 0}, </span>` +
                    `<span>C: ${Math.round(food.db_nutrition_per_serving.carbs) || 0}, </span>` +
                    `<span>F: ${Math.round(food.db_nutrition_per_serving.fat) || 0}</span></div>`;
            }
            if (food.total_nutrition_for_user) {
                html += `<div class="food-row"><span class="food-label">Total:</span> ` +
                    `<span>Cal: ${Math.round(food.total_nutrition_for_user.calories) || 0}, </span>` +
                    `<span>P: ${Math.round(food.total_nutrition_for_user.protein) || 0}, </span>` +
                    `<span>C: ${Math.round(food.total_nutrition_for_user.carbs) || 0}, </span>` +
                    `<span>F: ${Math.round(food.total_nutrition_for_user.fat) || 0}</span></div>`;
            }
            if (food.total_calories !== undefined && food.total_protein !== undefined && food.total_carbs !== undefined && food.total_fat !== undefined) {
                html += `<div class="food-row"><span class="food-label">Total:</span> ` +
                    `<span>Cal: ${Math.round(food.total_calories) || 0}, </span>` +
                    `<span>P: ${Math.round(food.total_protein) || 0}, </span>` +
                    `<span>C: ${Math.round(food.total_carbs) || 0}, </span>` +
                    `<span>F: ${Math.round(food.total_fat) || 0}</span></div>`;
            }
            if (food.note) {
                html += `<div class="food-row"><span class="food-note">${food.note}</span></div>`;
            }
            foodDiv.innerHTML = html;
            breakdownDiv.appendChild(foodDiv);
        });
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
}); 