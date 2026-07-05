package org.apache.datawise.backend.kafka;

import org.apache.datawise.backend.domain.KafkaProduceResultDto;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.serialization.StringSerializer;

import java.util.concurrent.Future;

/** Sends one record to a Kafka topic. */
public final class KafkaMessageProducer {

    private KafkaMessageProducer() {
    }

    public static KafkaProduceResultDto produceMessage(
            ConnectionEntity entity,
            String topic,
            String key,
            String value,
            Integer partition
    ) {
        if (topic == null || topic.isBlank()) {
            throw new IllegalArgumentException("Kafka topic is required");
        }
        if (value == null) {
            throw new IllegalArgumentException("Kafka message value is required");
        }
        try (KafkaProducer<String, String> producer = new KafkaProducer<>(
                KafkaClientFactory.producerProperties(entity),
                new StringSerializer(),
                new StringSerializer()
        )) {
            ProducerRecord<String, String> record = partition == null || partition < 0
                    ? new ProducerRecord<>(topic.trim(), key, value)
                    : new ProducerRecord<>(topic.trim(), partition, key, value);
            Future<RecordMetadata> future = producer.send(record);
            RecordMetadata metadata = future.get();
            return new KafkaProduceResultDto(metadata.topic(), metadata.partition(), metadata.offset());
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException(ex.getMessage(), ex);
        }
    }
}
