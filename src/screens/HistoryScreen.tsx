import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {COLORS} from '../utils/constants';
import {useHistory, HistoryEntry} from '../hooks/useHistory';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({navigation}: Props) {
  const {history, clear, reload} = useHistory();

  React.useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      reload();
    });
    return unsub;
  }, [navigation, reload]);

  const handleClear = () => {
    Alert.alert(
      'Clear History',
      'Delete all saved collisions? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clear,
        },
      ],
    );
  };

  const renderItem = ({item}: {item: HistoryEntry}) => {
    const dateStr = new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          navigation.navigate('Result', {
            problem: item.problem,
            result: item.result,
          })
        }>
        <Text style={styles.itemDate}>{dateStr}</Text>
        <Text style={styles.itemProblem} numberOfLines={2}>
          {item.problem}
        </Text>
        <Text style={styles.itemEssence} numberOfLines={1}>
          {item.result.structural_essence}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>HISTORY</Text>
        <View style={styles.topRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Text style={styles.searchText}>SEARCH</Text>
          </TouchableOpacity>
          {history.length > 0 && (
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.clearText}>CLEAR</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No collisions yet</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.mutedLight,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.text,
  },
  clearText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    color: COLORS.accentRed,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  searchText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: '#888880',
    textTransform: 'uppercase',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  item: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 16,
    marginBottom: 10,
  },
  itemDate: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.muted,
    marginBottom: 6,
  },
  itemProblem: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 19,
    marginBottom: 6,
  },
  itemEssence: {
    fontFamily: 'serif',
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.mutedLight,
    lineHeight: 18,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: COLORS.muted,
  },
});
