const { createApp, ref, onMounted } = Vue;

// Axios 인스턴스 생성
const api = axios.create({
    baseURL: 'https://port-0-be-chess-m85rwv28724587d4.sel4.cloudtype.app',
    headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json'
    }
});

createApp({
    setup() {
        const board = ref([]);
        const gameStarted = ref(false);
        const selectedPosition = ref(null);
        const isInitializing = ref(false);
        const gameResult = ref(null);
        const showResult = ref(false);
        const notification = ref({
            show: false,
            message: '',
            type: 'error'
        });

        const showNotification = (message, type = 'error') => {
            notification.value = {
                show: true,
                message,
                type
            };
            // 3초 후에 알림 숨기기
            setTimeout(() => {
                notification.value.show = false;
            }, 3000);
        };

        const clearGameState = () => {
            // 모든 상태 초기화
            board.value = [];
            gameStarted.value = false;
            selectedPosition.value = null;
            isInitializing.value = false;
            gameResult.value = null;
            showResult.value = false;
            notification.value.show = false;
            
            // 로컬 스토리지 초기화
            localStorage.clear();
            
            // 세션 스토리지 초기화
            sessionStorage.clear();
        };

        const initializeBoard = async () => {
            if (isInitializing.value) return;
            
            try {
                isInitializing.value = true;
                const timestamp = new Date().getTime();
                const response = await api.get(`/api/start?t=${timestamp}`);
                if (response.data.isSuccess) {
                    const boardStr = response.data.result.board;
                    board.value = boardStr
                        .split('\n')
                        .filter(row => row.length > 0)
                        .map(row => row.split(''));
                    gameStarted.value = true;
                    showNotification('게임이 시작되었습니다.', 'success');
                }
            } catch (error) {
                console.error('체스 보드 초기화 실패:', error);
                showNotification('체스 보드를 불러오는데 실패했습니다.');
            } finally {
                isInitializing.value = false;
            }
        };

        const getPositionNotation = (row, col) => {
            const files = 'abcdefgh';
            const ranks = '87654321';
            return files[col] + ranks[row];
        };

        const updateBoardAfterMove = (startPos, endPos) => {
            const [startRow, startCol] = getPositionFromNotation(startPos);
            const [endRow, endCol] = getPositionFromNotation(endPos);
            
            // 이동할 기물 저장
            const piece = board.value[startRow][startCol];
            
            // 출발 위치를 빈 칸으로
            board.value[startRow][startCol] = '.';
            
            // 도착 위치에 기물 배치
            board.value[endRow][endCol] = piece;
        };

        const getPositionFromNotation = (notation) => {
            const files = 'abcdefgh';
            const ranks = '87654321';
            const col = files.indexOf(notation[0]);
            const row = ranks.indexOf(notation[1]);
            return [row, col];
        };

        const fetchGameResult = async (winnerColor) => {
            try {
                const response = await api.get(`/api/result?color=${winnerColor}`);
                if (response.data.isSuccess) {
                    gameResult.value = response.data.result;
                    showResult.value = true;
                    gameStarted.value = false;
                }
            } catch (error) {
                console.error('게임 결과 조회 실패:', error);
                showNotification('게임 결과를 불러오는데 실패했습니다.');
            }
        };

        const movePiece = async (startPos, endPos) => {
            try {
                const timestamp = new Date().getTime();
                const response = await api.post(`/api/move?t=${timestamp}`, {
                    startPos,
                    endPos
                });
                
                if (response.data.isSuccess) {
                    updateBoardAfterMove(startPos, endPos);
                    // 킹이 잡혔는지 확인
                    if (response.data.message === '킹을 잡았습니다.') {
                        const [endRow, endCol] = getPositionFromNotation(endPos);
                        const winnerColor = board.value[endRow][endCol] === 'p' ? 'BLACK' : 'WHITE';
                        await fetchGameResult(winnerColor);
                        showNotification('킹이 잡혔습니다! 게임 종료!', 'success');
                    } else {
                        showNotification('기물이 이동되었습니다.', 'success');
                    }
                    return true;
                } else {
                    showNotification(response.data.message || '잘못된 이동입니다.');
                    return false;
                }
            } catch (error) {
                console.error('기물 이동 실패:', error);
                if (error.response && error.response.data) {
                    showNotification(error.response.data.message || '기물 이동에 실패했습니다.');
                } else {
                    showNotification('기물 이동에 실패했습니다.');
                }
                return false;
            }
        };

        const handleCellClick = async (row, col) => {
            if (!gameStarted.value) return;

            const position = getPositionNotation(row, col);
            
            if (!selectedPosition.value) {
                // 첫 번째 클릭: 기물 선택
                if (board.value[row][col] === '.') return; // 빈 칸 선택 방지
                selectedPosition.value = position;
                showNotification(`${board.value[row][col]} 기물이 선택되었습니다.`, 'success');
            } else {
                // 이미 선택된 위치를 다시 클릭한 경우
                if (selectedPosition.value === position) {
                    selectedPosition.value = null; // 선택 취소
                    showNotification('기물 선택이 취소되었습니다.', 'success');
                    return;
                }
                // 두 번째 클릭: 이동 시도
                const success = await movePiece(selectedPosition.value, position);
                selectedPosition.value = null; // 선택 초기화
            }
        };

        const startGame = async () => {
            clearGameState(); // 게임 시작 전 모든 상태 초기화
            await initializeBoard();
        };

        const isBlackCell = (row, col) => {
            return (row + col) % 2 === 1;
        };

        const isSelected = (row, col) => {
            return selectedPosition.value === getPositionNotation(row, col);
        };

        // 페이지 로드 시 상태 초기화
        onMounted(() => {
            clearGameState();
        });

        return {
            board,
            gameStarted,
            startGame,
            isBlackCell,
            handleCellClick,
            isSelected,
            gameResult,
            showResult,
            notification
        };
    }
}).mount('#app');
