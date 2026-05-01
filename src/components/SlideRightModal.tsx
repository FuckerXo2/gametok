import React, { useEffect, useRef } from 'react';
import { Modal, Animated, PanResponder, StyleSheet, Dimensions, View, GestureResponderEvent, PanResponderGestureState } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EDGE_ZONE_WIDTH = 25; // Width of left-edge swipe zone (in pts)

interface SlideRightModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    instant?: boolean;
}

export const SlideRightModal: React.FC<SlideRightModalProps> = ({ visible, onClose, children, instant = false }) => {
    const translateX = useRef(new Animated.Value(visible && instant ? 0 : SCREEN_WIDTH)).current;
    const backdropOpacity = useRef(new Animated.Value(visible && instant ? 1 : 0)).current;
    const isClosingRef = useRef(false);

    useEffect(() => {
        if (visible) {
            isClosingRef.current = false;
            if (instant) {
                translateX.setValue(0);
                backdropOpacity.setValue(1);
                return;
            }
            // Animate in
            Animated.parallel([
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    bounciness: 0,
                    speed: 20,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else if (!isClosingRef.current) {
            // Animate out (only if not already closing from swipe)
            Animated.parallel([
                Animated.timing(translateX, {
                    toValue: SCREEN_WIDTH,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const animateClose = () => {
        isClosingRef.current = true;
        Animated.parallel([
            Animated.timing(translateX, {
                toValue: SCREEN_WIDTH,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose();
        });
    };

    const handlePanMove = (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > 0) {
            translateX.setValue(gestureState.dx);
            const progress = Math.min(gestureState.dx / SCREEN_WIDTH, 1);
            backdropOpacity.setValue(1 - progress);
        }
    };

    const handlePanRelease = (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > SCREEN_WIDTH / 4 || gestureState.vx > 0.5) {
            animateClose();
        } else {
            Animated.parallel([
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    bounciness: 0,
                    speed: 20,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    };

    // Fallback pan handler for areas without scrollable content (e.g. headers)
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dx > 15 && Math.abs(gestureState.dy) < 50;
            },
            onPanResponderMove: handlePanMove,
            onPanResponderRelease: handlePanRelease,
        })
    ).current;

    // Left-edge gesture strip — this sits ON TOP of everything (including FlatList)
    // and captures horizontal swipes that start from the left edge of the screen.
    // This is the Instagram / iOS-style back gesture pattern.
    const edgePanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only capture if swiping mostly horizontally to the right
                return gestureState.dx > 5 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderTerminationRequest: () => false, // Don't let FlatList steal the gesture
            onPanResponderMove: handlePanMove,
            onPanResponderRelease: handlePanRelease,
        })
    ).current;

    if (!visible) return null;

    return (
        <Modal visible={true} transparent animationType="none" onRequestClose={animateClose}>
            <View style={StyleSheet.absoluteFill}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
                <Animated.View
                    style={[styles.container, { transform: [{ translateX }] }]}
                    {...panResponder.panHandlers}
                >
                    {children}
                    {/* Invisible left-edge swipe zone — overlays on top of all content */}
                    <View
                        style={styles.edgeZone}
                        {...edgePanResponder.panHandlers}
                    />
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    container: {
        flex: 1,
        width: SCREEN_WIDTH,
        shadowColor: '#000',
        shadowOffset: { width: -5, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    edgeZone: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: EDGE_ZONE_WIDTH,
        zIndex: 10,
        // backgroundColor: 'rgba(255,0,0,0.1)', // Uncomment to debug
    },
});
