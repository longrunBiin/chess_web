<template>
    <div class="container">
        <h1>체스 게임</h1>
        <div v-if="gameStatus === 'playing'" class="game-info">
            <div class="current-turn">현재 턴: {{ currentTurn }}</div>
            <div class="score">
                <div class="white-score">흰색 점수: {{ whiteScore }}</div>
                <div class="black-score">검은색 점수: {{ blackScore }}</div>
            </div>
        </div>
        <div v-if="gameStatus !== 'idle'" class="board-container">
            <div class="board">
                <div v-for="(row, rowIndex) in board" :key="rowIndex" class="row">
                    <div v-for="(piece, colIndex) in row" 
                         :key="colIndex" 
                         class="cell"
                         :class="{
                             'white': (rowIndex + colIndex) % 2 === 0,
                             'black': (rowIndex + colIndex) % 2 === 1,
                             'selected': isSelected(rowIndex, colIndex),
                             'valid-move': isValidMove(rowIndex, colIndex)
                         }"
                         @click="handleCellClick(rowIndex, colIndex)">
                        <div class="piece" v-if="piece">{{ piece }}</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="controls">
            <button @click="startGame" :disabled="gameStatus === 'playing'">
                {{ gameStatus === 'playing' ? '게임 진행중' : '게임 시작' }}
            </button>
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

        const initializeBoard = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/start`, {
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
                } else {
                    showNotification(response.data.message)
                }
            } catch (error) {
                showNotification('게임 초기화 중 오류가 발생했습니다.')
                console.error('Error:', error)
            }
        }

        const startGame = async () => {
            clearGameState()
            await initializeBoard()
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

            const clickedPiece = board.value[row][col]

            if (selectedPosition.value) {
                if (isSelected(row, col)) {
                    selectedPosition.value = null
                    return
                }

                if (isValidMove(row, col)) {
                    try {
                        const startPos = getCoordinateString(selectedPosition.value);
                        const endPos = getCoordinateString({ row, col });
                        
                        const moveResponse = await axios.post(`${API_URL}/api/move`, {
                            startPos,
                            endPos
                        }, {
                            headers: {
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache',
                                'Expires': '0'
                            }
                        })

                        if (moveResponse.data.isSuccess) {
                            const { result } = moveResponse.data;
                            
                            // 기물 이동 후 보드 업데이트
                            const fromPos = selectedPosition.value;
                            const toPos = { row, col };
                            
                            // 기존 위치의 기물을 새로운 위치로 이동
                            const movingPiece = board.value[fromPos.row][fromPos.col];
                            board.value[fromPos.row][fromPos.col] = '';
                            board.value[toPos.row][toPos.col] = movingPiece;
                            
                            selectedPosition.value = null;

                            // 턴 변경
                            currentTurn.value = currentTurn.value === 'white' ? 'black' : 'white';
                            showNotification(moveResponse.data.message, 'success');

                            // 킹을 잡았을 경우 게임 종료
                            if (moveResponse.data.message.includes('킹을 잡았습니다')) {
                                gameStatus.value = 'finished';
                                
                                // 결과 API 호출
                                const color = result.movePiece.white ? 'white' : 'black';
                                const resultResponse = await axios.get(`${API_URL}/api/result?color=${color}`);
                                
                                if (resultResponse.data.isSuccess) {
                                    const { result: gameResultData } = resultResponse.data;
                                    gameResult.value = {
                                        winner: gameResultData.winnerColor === 'WHITE' ? '흰색' : '검은색',
                                        winnerPieces: gameResultData.whiteScore,
                                        loserPieces: gameResultData.loserScore,
                                        winnerPiecesList: gameResultData.winnerPieces,
                                        loserPiecesList: gameResultData.loserPieces
                                    };
                                    
                                    // 점수 최종 업데이트
                                    if (gameResultData.winnerColor === 'WHITE') {
                                        whiteScore.value = gameResultData.whiteScore;
                                        blackScore.value = gameResultData.loserScore;
                                    } else {
                                        whiteScore.value = gameResultData.loserScore;
                                        blackScore.value = gameResultData.whiteScore;
                                    }
                                }
                            }
                        } else {
                            showNotification(moveResponse.data.message);
                        }
                    } catch (error) {
                        showNotification(error.response?.data?.message || '서버 오류가 발생했습니다.');
                        console.error('Error:', error);
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

.valid-move::after {
    content: '';
    width: 20px;
    height: 20px;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 50%;
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
</style> 