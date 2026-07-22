import React, { useEffect, useRef, useState } from 'react';
import { Modal, Animated, PanResponder, StyleSheet, Dimensions, View, GestureResponderEvent, PanResponderGestureState } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EDGE_ZONE_WIDTH = 25; // Width of left-edge swipe zone (in pts)

interface SlideRightModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    instant?: boolean;
    // Fires after the exit animation completes and the native Modal has fully
    // unmounted. Use this to chain into presenting another modal — presenting a
    // new native Modal while this one is still dismissing makes the new one
    // silently fail to appear on iOS.
    onClosed?: () => void;
}

export const SlideRightModal: React.FC<SlideRightModalProps> = ({ visible, onClose, children, instant = false, onClosed }) => {
    const translateX = useRef(new Animated.Value(visible && instant ? 0 : SCREEN_WIDTH)).current;
    const backdropOpacity = useRef(new Animated.Value(visible && instant ? 1 : 0)).current;
    const isClosingRef = useRef(false);
    const [shouldRender, setShouldRender] = useState(visible);

    // Hold the latest onClosed in a ref so it isn't a dependency of the
    // animation effect — an inline callback would otherwise restart the
    // open/close animation on every parent render.
    const onClosedRef = useRef(onClosed);
    onClosedRef.current = onClosed;

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
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
        } else if (shouldRender && !isClosingRef.current) {
            // Animate out before unmounting.
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
            ]).start(() => {
                setShouldRender(false);
                // Defer to the next frame so this modal's native unmount commits
                // (and iOS finishes dismissing) before any modal chained off
                // onClosed tries to present — React 19 batches the unmount with
                // the chained open, and iOS silently drops a modal presented
                // while another is still dismissing.
                requestAnimationFrame(() => onClosedRef.current?.());
            });
        }
    }, [visible, shouldRender, instant, translateX, backdropOpacity]);

    const animateClose = () => {
        if (isClosingRef.current) return;
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
            setShouldRender(false);
            onClose();
            // See the effect above: defer the chained-open so this modal's
            // native unmount commits first.
            requestAnimationFrame(() => onClosedRef.current?.());
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

    if (!shouldRender) return null;

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
