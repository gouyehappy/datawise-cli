package org.apache.datawise.backend.kafka;

import org.apache.datawise.backend.domain.KafkaTopicDetailDto;
import org.apache.datawise.backend.domain.KafkaTopicPartitionDto;
import org.apache.datawise.backend.domain.KafkaTopicsResultDto;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.ListTopicsOptions;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.TopicPartitionInfo;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/** Topic listing and metadata via AdminClient. */
public final class KafkaTopicAdmin {

    private KafkaTopicAdmin() {
    }

    public static void ping(ConnectionEntity entity) throws Exception {
        try (AdminClient admin = AdminClient.create(KafkaClientFactory.adminProperties(entity))) {
            admin.listTopics(new ListTopicsOptions().timeoutMs(5000)).names().get(5, TimeUnit.SECONDS);
        }
    }

    public static KafkaTopicsResultDto listTopics(ConnectionEntity entity, String pattern, int limit) {
        int pageSize = limit <= 0 ? 200 : Math.min(limit, 500);
        try (AdminClient admin = AdminClient.create(KafkaClientFactory.adminProperties(entity))) {
            List<String> topics = new ArrayList<>(admin.listTopics().names().get(15, TimeUnit.SECONDS));
            topics.sort(String.CASE_INSENSITIVE_ORDER);
            if (pattern != null && !pattern.isBlank()) {
                Pattern regex = Pattern.compile(convertGlobToRegex(pattern.trim()), Pattern.CASE_INSENSITIVE);
                topics = topics.stream().filter(name -> regex.matcher(name).matches()).toList();
            }
            int total = topics.size();
            if (topics.size() > pageSize) {
                topics = topics.subList(0, pageSize);
            }
            return new KafkaTopicsResultDto(topics, total);
        } catch (Exception ex) {
            throw new IllegalStateException(ex.getMessage(), ex);
        }
    }

    public static KafkaTopicDetailDto describeTopic(ConnectionEntity entity, String topic) {
        if (topic == null || topic.isBlank()) {
            throw new IllegalArgumentException("Kafka topic is required");
        }
        String topicName = topic.trim();
        try (AdminClient admin = AdminClient.create(KafkaClientFactory.adminProperties(entity))) {
            TopicDescription description = admin.describeTopics(List.of(topicName))
                    .allTopicNames()
                    .get(15, TimeUnit.SECONDS)
                    .get(topicName);
            if (description == null) {
                throw new IllegalArgumentException("Topic not found: " + topicName);
            }
            List<TopicPartitionInfo> partitions = description.partitions();
            short replication = partitions.isEmpty()
                    ? 0
                    : (short) partitions.get(0).replicas().size();

            Map<TopicPartition, OffsetSpec> earliestSpecs = new HashMap<>();
            Map<TopicPartition, OffsetSpec> latestSpecs = new HashMap<>();
            for (TopicPartitionInfo info : partitions) {
                TopicPartition tp = new TopicPartition(topicName, info.partition());
                earliestSpecs.put(tp, OffsetSpec.earliest());
                latestSpecs.put(tp, OffsetSpec.latest());
            }

            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> earliest =
                    admin.listOffsets(earliestSpecs).all().get(15, TimeUnit.SECONDS);
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> latest =
                    admin.listOffsets(latestSpecs).all().get(15, TimeUnit.SECONDS);

            List<KafkaTopicPartitionDto> partitionDtos = new ArrayList<>();
            for (TopicPartitionInfo info : partitions) {
                TopicPartition tp = new TopicPartition(topicName, info.partition());
                long beginning = earliest.getOrDefault(tp, null) == null ? 0L : earliest.get(tp).offset();
                long end = latest.getOrDefault(tp, null) == null ? beginning : latest.get(tp).offset();
                partitionDtos.add(new KafkaTopicPartitionDto(info.partition(), beginning, end));
            }
            partitionDtos.sort(Comparator.comparingInt(KafkaTopicPartitionDto::partition));
            return new KafkaTopicDetailDto(
                    description.name(),
                    partitions.size(),
                    replication,
                    partitionDtos
            );
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException(ex.getMessage(), ex);
        }
    }

    static String convertGlobToRegex(String pattern) {
        StringBuilder regex = new StringBuilder("^");
        for (int i = 0; i < pattern.length(); i++) {
            char ch = pattern.charAt(i);
            if (ch == '*') {
                regex.append(".*");
            } else if ("\\.[]{}()+?^$|".indexOf(ch) >= 0) {
                regex.append('\\').append(ch);
            } else {
                regex.append(ch);
            }
        }
        return regex.append('$').toString();
    }
}
