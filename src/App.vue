<template>
    <div class="container">
        <h1>체스 게임</h1>
        <div v-if="gameStatus === 'playing'" class="game-info">
            <div class="current-turn">현재 턴: {{ currentTurn }}</div>
            <div v-if="isAIThinking" class="ai-thinking">
                <div class="thinking-dots"></div>
            </div>
        </div>
        <div v-if="gameStatus !== 'idle'" class="board-container">
            <div class="rank-labels">
                <div v-for="i in 8" :key="i" class="rank-label">
                    {{ 9 - i }}
                </div>
            </div>
            <div class="board-wrapper">
                <div class="board">
                    <div v-for="(row, rowIndex) in board" :key="rowIndex" class="row">
                        <div v-for="(piece, colIndex) in row" 
                             :key="colIndex" 
                             class="cell"
                             :class="{
                                 'white': (rowIndex + colIndex) % 2 === 0,
                                 'black': (rowIndex + colIndex) % 2 === 1,
                                 'selected': isSelected(rowIndex, colIndex)
                             }"
                             @click="handleCellClick(rowIndex, colIndex)">
                            <div class="piece" v-if="piece">{{ piece }}</div>
                        </div>
                    </div>
                </div>
                <div class="file-labels">
                    <div v-for="i in 8" :key="i" class="file-label">
                        {{ String.fromCharCode(96 + i) }}
                    </div>
                </div>
            </div>
        </div>
        <div class="controls">
            <div v-if="gameStatus === 'idle'" class="game-modes">
                <h2>게임 모드 선택</h2>
                <div class="mode-buttons">
                    <button @click="startSoloGame">혼자하기</button>
                    <button @click="startAIGame">AI와 하기</button>
                </div>
            </div>
            <div v-if="gameStatus === 'idle' && showAIOptions" class="ai-options">
                <h3>AI 난이도 선택</h3>
                <div class="difficulty-buttons">
                    <button @click="selectDifficulty('easy')">쉬움</button>
                    <button @click="selectDifficulty('normal')">보통</button>
                    <button @click="selectDifficulty('hard')">어려움</button>
                </div>
            </div>
            <div v-if="gameStatus === 'idle' && showTeamSelection" class="team-selection">
                <h3>팀 선택</h3>
                <div class="team-buttons">
                    <button @click="selectTeam('white')">흰색 팀</button>
                    <button @click="selectTeam('black')">검은색 팀</button>
                </div>
            </div>
            <button v-if="gameStatus === 'finished'" @click="startGame">다시 시작</button>
        </div>
        <div v-if="gameStatus === 'playing'" class="coordinates">
            <div class="coordinate-info" v-if="selectedPosition">
                선택된 위치: {{ getCoordinateString(selectedPosition) }}
            </div>
        </div>
    </div>
    <div v-if="notification.show" 
         class="notification" 
         :class="notification.type">
        {{ notification.message }}
    </div>
    <div v-if="gameResult" class="game-result">
        <h2>게임 종료!</h2>
        <p>{{ gameResult.winner }} 팀 승리!</p>
        <div class="final-score">
            <div class="winner-info">
                <h3>승리 팀 ({{ gameResult.winner }})</h3>
                <p>총 점수: {{ gameResult.winnerPieces }}</p>
                <div class="pieces-list">
                    <div v-for="(piece, index) in gameResult.winnerPiecesList" 
                         :key="index" 
                         class="piece-item">
                        <span class="piece-name">{{ getPieceName(piece.name) }}</span>
                        <span class="piece-score">({{ piece.score }}점)</span>
                    </div>
                </div>
            </div>
            <div class="loser-info">
                <h3>패배 팀 ({{ gameResult.winner === '흰색' ? '검은색' : '흰색' }})</h3>
                <p>총 점수: {{ gameResult.loserPieces }}</p>
                <div class="pieces-list">
                    <div v-for="(piece, index) in gameResult.loserPiecesList" 
                         :key="index" 
                         class="piece-item">
                        <span class="piece-name">{{ getPieceName(piece.name) }}</span>
                        <span class="piece-score">({{ piece.score }}점)</span>
                    </div>
                </div>
            </div>
        </div>
        <button @click="startGame">다시 시작</button>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import axios from 'axios'

export default {
    name: 'App',
    setup() {
        const board = ref([])
        const currentTurn = ref('white')
        const gameStatus = ref('idle')
        const selectedPosition = ref(null)
        const whiteScore = ref(0)
        const blackScore = ref(0)
        const gameResult = ref(null)
        const notification = ref({
            show: false,
            message: '',
            type: 'error'
        })
        const showAIOptions = ref(false)
        const showTeamSelection = ref(false)
        const selectedDifficulty = ref(null)
        const selectedTeam = ref(null)
        const isAIMode = ref(false)
        const isAIThinking = ref(false)

        const API_URL = import.meta.env.VITE_API_URL

        const showNotification = (message, type = 'error') => {
            notification.value = {
                show: true,
                message,
                type
            }
            setTimeout(() => {
                notification.value.show = false
            }, 3000)
        }

        const parseBoard = (boardStr) => {
            return boardStr.split('\n')
                .filter(row => row.length === 8)  // 8개의 문자를 가진 행만 선택
                .map(row => {
                    return row.split('').map(char => {
                        return char === '.' ? '' : char;
                    });
                });
        }

        const clearGameState = () => {
            board.value = []
            currentTurn.value = 'white'
            gameStatus.value = 'idle'
            selectedPosition.value = null
            whiteScore.value = 0
            blackScore.value = 0
            gameResult.value = null
            localStorage.clear()
            sessionStorage.clear()
        }

        const startSoloGame = () => {
            isAIMode.value = false
            showTeamSelection.value = true
        }

        const startAIGame = () => {
            isAIMode.value = true
            showAIOptions.value = true
        }

        const selectDifficulty = (difficulty) => {
            selectedDifficulty.value = difficulty
            showAIOptions.value = false
            showTeamSelection.value = true
        }

        const selectTeam = (team) => {
            selectedTeam.value = team
            showTeamSelection.value = false
            if (isAIMode.value) {
                // AI 모드일 경우 플레이어의 반대 색상을 color로 설정
                const oppositeColor = team === 'white' ? 'black' : 'white'
                startGame(selectedDifficulty.value, oppositeColor)
            } else {
                // 혼자하기 모드일 경우
                startGame('none', team)
            }
        }

        const startGame = async (difficulty, color) => {
            clearGameState()
            try {
                const response = await axios.get(`${API_URL}/api/start`, {
                    params: {
                        difficulty: difficulty,
                        color: color
                    },
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                })
                
                if (response.data.isSuccess) {
                    const parsedBoard = parseBoard(response.data.result.board)
                    board.value = parsedBoard
                    currentTurn.value = 'white'
                    gameStatus.value = 'playing'
                    showNotification(response.data.message, 'success')

                    // AI 모드이고 검은색 팀을 선택한 경우, AI의 첫 수를 요청
                    if (isAIMode.value && selectedTeam.value === 'black') {
                        await requestAIMove()
                    }
                } else {
                    showNotification(response.data.message)
                }
            } catch (error) {
                showNotification('게임 초기화 중 오류가 발생했습니다.')
                console.error('Error:', error)
            }
        }

        const requestAIMove = async (retryCount = 0) => {
            const MAX_RETRIES = 3
            isAIThinking.value = true
            showNotification('AI가 수를 고민하고 있습니다...', 'info')
            
            // 2초 지연
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            try {
                const response = await axios.post(`${API_URL}/api/move/ai`)
                
                if (response.data.isSuccess) {
                    const { result } = response.data
                    const startPos = result.startPos
                    const endPos = result.endPos
                    
                    // 시작 위치와 도착 위치를 좌표로 변환
                    const startCol = startPos.charCodeAt(0) - 97
                    const startRow = 8 - parseInt(startPos[1])
                    const endCol = endPos.charCodeAt(0) - 97
                    const endRow = 8 - parseInt(endPos[1])
                    
                    // 기물 이동이 유효한지 확인
                    if (startPos === endPos || !board.value[startRow][startCol]) {
                        if (retryCount < MAX_RETRIES) {
                            isAIThinking.value = false
                            return requestAIMove(retryCount + 1)
                        } else {
                            throw new Error('AI가 유효한 움직임을 찾지 못했습니다.')
                        }
                    }
                    
                    // 기물 이동
                    const movingPiece = board.value[startRow][startCol]
                    board.value[startRow][startCol] = ''
                    board.value[endRow][endCol] = movingPiece
                    
                    currentTurn.value = currentTurn.value === 'white' ? 'black' : 'white'
                    showNotification(response.data.message, 'success')

                    // AI가 킹을 잡은 경우 게임 종료 처리
                    if (response.data.message.includes('킹을 잡았습니다')) {
                        gameStatus.value = 'finished'
                        
                        const color = result.movePiece.white ? 'white' : 'black'
                        const resultResponse = await axios.get(`${API_URL}/api/result?color=${color}`)
                        
                        if (resultResponse.data.isSuccess) {
                            const { result: gameResultData } = resultResponse.data
                            gameResult.value = {
                                winner: gameResultData.winnerColor === 'WHITE' ? '흰색' : '검은색',
                                winnerPieces: gameResultData.whiteScore,
                                loserPieces: gameResultData.loserScore,
                                winnerPiecesList: gameResultData.winnerPieces,
                                loserPiecesList: gameResultData.loserPieces
                            }
                        }
                    }
                } else {
                    // 실패한 경우 재시도
                    if (retryCount < MAX_RETRIES) {
                        isAIThinking.value = false
                        return requestAIMove(retryCount + 1)
                    } else {
                        showNotification('AI가 유효한 움직임을 찾지 못했습니다.')
                    }
                }
            } catch (error) {
                // 에러 발생 시 재시도
                if (retryCount < MAX_RETRIES) {
                    isAIThinking.value = false
                    return requestAIMove(retryCount + 1)
                } else {
                    showNotification('AI 수 요청 중 오류가 발생했습니다.')
                    console.error('Error:', error)
                }
            } finally {
                isAIThinking.value = false
            }
        }

        const isSelected = (row, col) => {
            return selectedPosition.value && 
                   selectedPosition.value.row === row && 
                   selectedPosition.value.col === col
        }

        const isValidMove = (row, col) => {
            if (!selectedPosition.value) return false
            const selectedPiece = board.value[selectedPosition.value.row][selectedPosition.value.col]
            if (!selectedPiece) return false
            return true
        }

        const getCoordinateString = (position) => {
            const col = String.fromCharCode(97 + position.col)
            return `${col}${8 - position.row}`
        }

        const handleCellClick = async (row, col) => {
            if (gameStatus.value !== 'playing') return

            // AI 모드일 때 자신의 턴이 아닌 경우 클릭 무시
            if (isAIMode.value && 
                ((selectedTeam.value === 'white' && currentTurn.value === 'black') ||
                 (selectedTeam.value === 'black' && currentTurn.value === 'white'))) {
                return
            }

            const clickedPiece = board.value[row][col]

            if (selectedPosition.value) {
                if (isSelected(row, col)) {
                    selectedPosition.value = null
                    return
                }

                if (isValidMove(row, col)) {
                    try {
                        const startPos = getCoordinateString(selectedPosition.value)
                        const endPos = getCoordinateString({ row, col })
                        
                        const moveResponse = await axios.post(`${API_URL}/api/move`, {
                            startPos,
                            endPos
                        })

                        if (moveResponse.data.isSuccess) {
                            const { result } = moveResponse.data
                            
                            const fromPos = selectedPosition.value
                            const toPos = { row, col }
                            
                            const movingPiece = board.value[fromPos.row][fromPos.col]
                            board.value[fromPos.row][fromPos.col] = ''
                            board.value[toPos.row][toPos.col] = movingPiece
                            
                            selectedPosition.value = null
                            currentTurn.value = currentTurn.value === 'white' ? 'black' : 'white'
                            showNotification(moveResponse.data.message, 'success')

                            // AI 모드일 때 플레이어의 수가 끝나면 AI의 수를 요청
                            if (isAIMode.value && 
                                ((selectedTeam.value === 'white' && currentTurn.value === 'black') ||
                                 (selectedTeam.value === 'black' && currentTurn.value === 'white'))) {
                                await requestAIMove()
                            }

                            if (moveResponse.data.message.includes('킹을 잡았습니다')) {
                                gameStatus.value = 'finished'
                                
                                const color = result.movePiece.white ? 'white' : 'black'
                                const resultResponse = await axios.get(`${API_URL}/api/result?color=${color}`)
                                
                                if (resultResponse.data.isSuccess) {
                                    const { result: gameResultData } = resultResponse.data
                                    gameResult.value = {
                                        winner: gameResultData.winnerColor === 'WHITE' ? '흰색' : '검은색',
                                        winnerPieces: gameResultData.whiteScore,
                                        loserPieces: gameResultData.loserScore,
                                        winnerPiecesList: gameResultData.winnerPieces,
                                        loserPiecesList: gameResultData.loserPieces
                                    }
                                }
                            }
                        } else {
                            showNotification(moveResponse.data.message)
                        }
                    } catch (error) {
                        showNotification(error.response?.data?.message || '서버 오류가 발생했습니다.')
                        console.error('Error:', error)
                    }
                } else {
                    showNotification('해당 위치로 이동할 수 없습니다.')
                }
            } else if (clickedPiece) {
                selectedPosition.value = { row, col }
            }
        }

        const getPieceName = (name) => {
            const pieceNames = {
                'PAWN': '폰',
                'ROOK': '룩',
                'KNIGHT': '나이트',
                'BISHOP': '비숍',
                'QUEEN': '퀸',
                'KING': '킹'
            };
            return pieceNames[name] || name;
        }

        onMounted(() => {
            clearGameState()
        })

        return {
            board,
            currentTurn,
            gameStatus,
            selectedPosition,
            whiteScore,
            blackScore,
            gameResult,
            notification,
            showAIOptions,
            showTeamSelection,
            selectedDifficulty,
            selectedTeam,
            isAIMode,
            isAIThinking,
            startSoloGame,
            startAIGame,
            selectDifficulty,
            selectTeam,
            startGame,
            isSelected,
            isValidMove,
            getCoordinateString,
            handleCellClick,
            getPieceName
        }
    }
}
</script>

<style>
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f0f0f0;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
}

h1 {
    color: #333;
    margin-bottom: 20px;
}

.game-info {
    margin-bottom: 20px;
}

.current-turn {
    font-size: 1.2em;
    margin-bottom: 10px;
}

.score {
    display: flex;
    justify-content: center;
    gap: 20px;
}

.board-container {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
    align-items: center;
}

.board-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.board {
    border: 2px solid #333;
    display: inline-block;
}

.row {
    display: flex;
}

.cell {
    width: 60px;
    height: 60px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
}

.white {
    background-color: #fff;
}

.black {
    background-color: #769656;
}

.selected {
    background-color: #baca44;
}

.piece {
    font-size: 2em;
    user-select: none;
}

.controls {
    margin-bottom: 20px;
}

button {
    padding: 10px 20px;
    font-size: 1.1em;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
}

button:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}

.coordinates {
    margin-top: 20px;
}

.notification {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 15px 30px;
    border-radius: 5px;
    font-size: 1.1em;
    z-index: 1000;
    animation: slideDown 0.3s ease-out;
}

.notification.error {
    background-color: #ff4444;
    color: white;
}

.notification.success {
    background-color: #4CAF50;
    color: white;
}

.notification.info {
    background-color: #2196F3;
    color: white;
}

.game-result {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
    text-align: center;
    z-index: 1000;
    max-width: 600px;
    width: 90%;
}

.final-score {
    margin: 20px 0;
    display: flex;
    gap: 30px;
    justify-content: space-between;
}

.winner-info, .loser-info {
    flex: 1;
    padding: 15px;
    border-radius: 8px;
}

.winner-info {
    background-color: #e8f5e9;
}

.loser-info {
    background-color: #ffebee;
}

.pieces-list {
    margin-top: 10px;
    text-align: left;
    max-height: 200px;
    overflow-y: auto;
}

.piece-item {
    display: flex;
    justify-content: space-between;
    padding: 5px 10px;
    border-bottom: 1px solid #ddd;
}

.piece-name {
    font-weight: bold;
}

.piece-score {
    color: #666;
}

h3 {
    margin: 0 0 10px 0;
    color: #333;
}

.rank-labels {
    display: flex;
    flex-direction: column;
    margin-right: 10px;
}

.rank-label {
    height: 60px;
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #333;
}

.file-labels {
    display: flex;
    justify-content: center;
    margin-top: 10px;
}

.file-label {
    width: 60px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #333;
}

.game-modes {
    margin-bottom: 20px;
}

.mode-buttons, .difficulty-buttons, .team-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 10px;
}

.ai-options, .team-selection {
    margin-top: 20px;
}

h2, h3 {
    color: #333;
    margin-bottom: 15px;
}

@keyframes slideDown {
    from {
        transform: translate(-50%, -100%);
    }
    to {
        transform: translate(-50%, 0);
    }
}

@keyframes fadeOut {
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
    }
}

.ai-thinking {
    margin-top: 10px;
}

.thinking-dots {
    display: inline-block;
    position: relative;
    width: 64px;
    height: 64px;
}

.thinking-dots:after {
    content: " ";
    display: block;
    border-radius: 50%;
    width: 0;
    height: 0;
    margin: 8px;
    box-sizing: border-box;
    border: 24px solid #2196F3;
    border-color: #2196F3 transparent #2196F3 transparent;
    animation: thinking-dots 1.2s infinite;
}

@keyframes thinking-dots {
    0% {
        transform: rotate(0);
        animation-timing-function: cubic-bezier(0.55, 0.055, 0.675, 0.19);
    }
    50% {
        transform: rotate(900deg);
        animation-timing-function: cubic-bezier(0.215, 0.61, 0.355, 1);
    }
    100% {
        transform: rotate(1800deg);
    }
}
</style> 