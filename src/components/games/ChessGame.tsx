// Chess Multiplayer Game
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 40, 360);
const CELL_SIZE = BOARD_SIZE / 8;

interface ChessGameProps {
  gameState: {
    fen: string;
    colors: Record<string, string>;
    moves: string[];
  };
  onMove: (move: { from: string; to: string }) => void;
  isMyTurn: boolean;
  mySymbol: string;
  colors: any;
}

// Piece unicode characters
const PIECES: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

const ChessGame: React.FC<ChessGameProps> = ({
  gameState,
  onMove,
  isMyTurn,
  mySymbol,
  colors,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const isWhite = mySymbol === 'white';

  // Parse FEN to board array
  const board = useMemo(() => {
    const rows = gameState.fen.split(' ')[0].split('/');
    const result: (string | null)[][] = [];
    
    for (const row of rows) {
      const boardRow: (string | null)[] = [];
      for (const char of row) {
        if (isNaN(parseInt(char))) {
          boardRow.push(char);
        } else {
          for (let i = 0; i < parseInt(char); i++) {
            boardRow.push(null);
          }
        }
      }
      result.push(boardRow);
    }
    return isWhite ? result : result.reverse().map(row => row.reverse());
  }, [gameState.fen, isWhite]);

  const getSquareName = (row: number, col: number): string => {
    if (isWhite) {
      return String.fromCharCode(97 + col) + (8 - row);
    } else {
      return String.fromCharCode(97 + (7 - col)) + (row + 1);
    }
  };

  const handleSquarePress = (row: number, col: number) => {
    if (!isMyTurn) return;
    
    const square = getSquareName(row, col);
    const piece = board[row][col];
    
    if (selectedSquare) {
      // Try to make a move
      if (selectedSquare !== square) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onMove({ from: selectedSquare, to: square });
      }
      setSelectedSquare(null);
    } else if (piece) {
      // Select a piece
      const isMyPiece = isWhite ? piece === piece.toUpperCase() : piece === piece.toLowerCase();
      if (isMyPiece) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedSquare(square);
      }
    }
  };

  const isSelected = (row: number, col: number) => {
    return selectedSquare === getSquareName(row, col);
  };

  return (
    <View style={styles.container}>
      <View style={styles.playerInfo}>
        <Text style={[styles.colorLabel, { color: colors.textSecondary }]}>
          You are playing as
        </Text>
        <View style={[styles.colorIndicator, { backgroundColor: isWhite ? '#fff' : '#1a1a1a' }]}>
          <Text style={{ color: isWhite ? '#000' : '#fff', fontWeight: '700' }}>
            {isWhite ? 'White' : 'Black'}
          </Text>
        </View>
      </View>

      <View style={[styles.board, { backgroundColor: '#8b4513' }]}>
        {board.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((piece, colIndex) => {
              const isLight = (rowIndex + colIndex) % 2 === 0;
              const selected = isSelected(rowIndex, colIndex);
              
              return (
                <TouchableOpacity
                  key={colIndex}
                  style={[
                    styles.cell,
                    { backgroundColor: isLight ? '#f0d9b5' : '#b58863' },
                    selected && styles.cellSelected,
                  ]}
                  onPress={() => handleSquarePress(rowIndex, colIndex)}
                  activeOpacity={0.7}
                >
                  {piece && (
                    <Text style={[
                      styles.piece,
                      { color: piece === piece.toUpperCase() ? '#fff' : '#000' },
                      { textShadowColor: piece === piece.toUpperCase() ? '#000' : '#fff' },
                    ]}>
                      {PIECES[piece]}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={[styles.turnText, { color: colors.textSecondary }]}>
        {isMyTurn ? "Your turn - tap a piece to move" : "Waiting for opponent..."}
      </Text>

      {/* Move history */}
      {gameState.moves.length > 0 && (
        <ScrollView horizontal style={styles.movesContainer}>
          {gameState.moves.map((move, i) => (
            <View key={i} style={[styles.moveChip, { backgroundColor: colors.surface }]}>
              <Text style={[styles.moveText, { color: colors.text }]}>{move}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 10 },
  playerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  colorLabel: { fontSize: 14 },
  colorIndicator: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#666' },
  board: { borderRadius: 8, overflow: 'hidden', padding: 4 },
  row: { flexDirection: 'row' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, justifyContent: 'center', alignItems: 'center' },
  cellSelected: { backgroundColor: '#7cb342 !important', opacity: 0.8 },
  piece: { fontSize: CELL_SIZE * 0.7, textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  turnText: { marginTop: 20, fontSize: 16 },
  movesContainer: { marginTop: 20, maxHeight: 40 },
  moveChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 8 },
  moveText: { fontSize: 12, fontWeight: '600' },
});

export default ChessGame;
