# Balloon Popping Game - Specification

## Project Overview
- **Project Name**: Balloon Pop
- **Type**: Browser-based casual game
- **Core Functionality**: Players click on balloons rising from the bottom of the screen to pop them and earn points within a 60-second time limit
- **Target Users**: Casual gamers of all ages

## Visual Specification

### Canvas Setup
- Full browser window canvas (responsive)
- Background: Gradient sky (light blue to white)
- Balloons: Various colors with subtle gradient and shine effect
- UI: Score display (top-left), Timer display (top-right), Game over overlay

### Visual Style
- Clean, playful aesthetic
- Soft colors and rounded shapes
- Smooth animations for balloon movement and popping effect

## Game Mechanics

### Balloon Behavior
- Balloons spawn at random x-positions along the bottom
- Random colors: Red, Blue, Green, Yellow, Purple, Orange
- Random size: 40-70px diameter
- Random rise speed: 2-5 pixels per frame
- Slight horizontal wobble during ascent
- Disappear when reaching top of screen

### Special Balloons

#### Golden Balloon (8% spawn chance)
- Appearance: Gold/yellow color with sparkle effect orbiting around it
- Speed: Faster (4-6 pixels per frame)
- Scoring: 20 points (double the normal amount)
- Visual: Rotating sparkle particles around the balloon

#### Bomb Balloon (7% spawn chance)
- Appearance: Dark gray/black with a fuse on top
- Fuse effect: Glowing red ember that pulses
- Speed: Normal (2-4 pixels per frame)
- Effect on click: -20 points and -5 seconds from timer
- Visual: Orange/red explosion particles when clicked

### Scoring
- Base points: 10 points per balloon
- Larger balloons: 15 points
- Smaller balloons: 5 points
- Golden balloons: 20 points (double)
- Bomb balloons: -20 points (penalty)

### Timer
- 60 seconds countdown
- Display format: "Time: XX"
- Game ends when timer reaches 0

### Game States
1. **Playing**: Balloons rising, timer counting down
2. **Game Over**: Overlay with final score and "Play Again" button

## Interaction Specification

### Mouse Controls
- Click on balloon to pop it
- Cursor changes to pointer when hovering over balloon

### Popping Effect
- Balloon scales up briefly then disappears
- Optional: particle burst effect

## UI Elements

### During Game
- Score: Top-left, large font, "Score: XXX"
- Timer: Top-right, large font, "Time: XX"

### Game Over Screen
- Semi-transparent dark overlay
- "Game Over!" title
- "Final Score: XXX"
- "Play Again" button

## Technical Implementation

### Structure
- Single HTML file with embedded CSS and JavaScript
- Canvas element for game rendering
- RequestAnimationFrame for smooth animation loop

### Game Loop
1. Clear canvas
2. Update balloon positions
3. Check for popped balloons (click detection)
4. Remove off-screen balloons
5. Spawn new balloons at intervals
6. Draw all elements
7. Update UI
8. Check game over condition

## Acceptance Criteria

1. ✓ Balloons spawn randomly at bottom and rise upward
2. ✓ Clicking a balloon pops it and adds to score
3. ✓ 60-second countdown timer displayed
4. ✓ Game ends after 60 seconds
5. ✓ Final score displayed in game over screen
6. ✓ Play Again button restarts the game
7. ✓ Smooth 60fps animation
8. ✓ Responsive canvas sizing
9. ✓ Golden balloons award double points and move faster
10. ✓ Bomb balloons deduct points and time when clicked
