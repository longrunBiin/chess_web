import { createApp, ref, onMounted } from 'vue'
import axios from 'axios'

const app = createApp({
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
                const response = await axios.get(`${API_URL}/api/chess/board`, {
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                })
                board.value = response.data.board
                currentTurn.value = response.data.currentTurn
                gameStatus.value = 'playing'
            } catch (error) {
                showNotification('게임 초기화 중 오류가 발생했습니다.')
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

            const isWhitePiece = selectedPiece === selectedPiece.toUpperCase()
            if ((currentTurn.value === 'white' && !isWhitePiece) ||
                (currentTurn.value === 'black' && isWhitePiece)) {
                return false
            }

            return true
        }

        const getCoordinateString = (position) => {
            const col = String.fromCharCode(97 + position.col)
            return `${col}${8 - position.row}`
        }

        const handleCellClick = async (row, col) => {
            if (gameStatus.value !== 'playing') return

            const clickedPiece = board.value[row][col]
            const isWhitePiece = clickedPiece && clickedPiece === clickedPiece.toUpperCase()

            if (selectedPosition.value) {
                if (isSelected(row, col)) {
                    selectedPosition.value = null
                    return
                }

                if (isValidMove(row, col)) {
                    try {
                        const response = await axios.post(`${API_URL}/api/chess/move`, {
                            from: {
                                row: selectedPosition.value.row,
                                col: selectedPosition.value.col
                            },
                            to: { row, col }
                        }, {
                            headers: {
                                'Cache-Control': 'no-cache',
                                'Pragma': 'no-cache',
                                'Expires': '0'
                            }
                        })

                        board.value = response.data.board
                        currentTurn.value = response.data.currentTurn
                        selectedPosition.value = null

                        if (response.data.gameStatus === 'finished') {
                            gameResult.value = {
                                winner: response.data.winner,
                                winnerPieces: response.data.winnerPieces,
                                loserPieces: response.data.loserPieces
                            }
                            gameStatus.value = 'finished'
                            showNotification(`${response.data.winner} 팀 승리!`, 'success')
                        } else {
                            showNotification('이동 성공!', 'success')
                        }
                    } catch (error) {
                        showNotification(error.response?.data?.message || '이동할 수 없는 위치입니다.')
                    }
                } else {
                    showNotification('잘못된 이동입니다.')
                }
            } else if (clickedPiece) {
                if ((currentTurn.value === 'white' && isWhitePiece) ||
                    (currentTurn.value === 'black' && !isWhitePiece)) {
                    selectedPosition.value = { row, col }
                } else {
                    showNotification('현재 턴이 아닙니다.')
                }
            }
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
            handleCellClick
        }
    }
})

app.mount('#app') 